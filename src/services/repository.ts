import type {
  ChannelCostEntry,
  CommissionInstallment,
  MrrChannelBreakdownItem,
  NewMrrEntry,
  Partner,
  Referral
} from '../types';
import { supabase } from './supabaseClient';

// ---------------------------------------------------------------------------
// Repositório relacional: cada parceiro/indicação/custo/MRR é uma LINHA no
// Supabase. Substitui o blob único de system_backups como fonte da verdade.
//
// A interface do app continua síncrona (localStorage pinta a tela na hora); o
// que muda é que cada save agora envia só os registros que mudaram, como
// upsert/delete por linha. Duas pessoas editando registros diferentes deixam
// de se sobrescrever, e exclusão passa a ser exclusão de verdade.
//
// Escrita que falha (offline, rede caindo) não some: fica numa fila de
// pendências no próprio navegador e é reenviada no próximo flush/sync. Enquanto
// um id está pendente, a versão local dele vence a do servidor no merge — senão
// uma edição feita offline seria apagada pela cópia antiga do servidor.
// ---------------------------------------------------------------------------

export type TableName = 'partners' | 'referrals' | 'channel_costs' | 'new_mrr_entries' | 'app_settings';
export type PendingOp = 'upsert' | 'delete';

const OUTBOX_KEY = 'canal_escritas_pendentes_v1';
const FLUSH_DEBOUNCE_MS = 600;

export const SETTING_PRICING_PLANS = 'pricing_plans';
export const SETTING_PARTNER_TIERS = 'partner_tiers';
// Marcador de que a carga inicial para as tabelas já aconteceu.
export const SETTING_MIGRATION_DONE = 'migration_done';

// ---------------------------------------------------------------------------
// Mapeamento dominio <-> linha
//
// Mora em rowMappers.ts porque e puro: sem supabaseClient (import.meta.env) e
// sem localStorage, roda tanto no browser quanto em Node. E o que deixa o
// servidor MCP (mcp-server/) ler as mesmas tabelas sem uma segunda copia do
// mapeamento. Reexportado aqui para que os imports existentes sigam valendo.
// ---------------------------------------------------------------------------

export {
  undef,
  numOrUndef,
  partnerToRow,
  rowToPartner,
  referralToRow,
  rowToReferral,
  costToRow,
  rowToCost,
  mrrToRow,
  rowToMrr
} from './rowMappers';
export type { Row } from './rowMappers';

import {
  undef,
  numOrUndef,
  rowToPartner,
  rowToReferral,
  rowToCost,
  rowToMrr,
  partnerToRow,
  referralToRow,
  costToRow,
  mrrToRow,
  type Row
} from './rowMappers';

// ---------------------------------------------------------------------------
// Fila de escritas pendentes
// ---------------------------------------------------------------------------

type Outbox = Record<string, PendingOp>; // "tabela:id" -> operação

function loadOutbox(): Outbox {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (raw) return JSON.parse(raw) as Outbox;
  } catch {
    /* fila ilegível: recomeça vazia, o sync completo reconcilia */
  }
  return {};
}

function saveOutbox(outbox: Outbox): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
  } catch {
    /* sem espaço: a escrita direta abaixo ainda tenta subir */
  }
}

export function pendingIdsFor(table: TableName): Set<string> {
  const ids = new Set<string>();
  const outbox = loadOutbox();
  for (const key of Object.keys(outbox)) {
    const [t, ...rest] = key.split(':');
    if (t === table) ids.add(rest.join(':'));
  }
  return ids;
}

/** Quantas linhas ainda não subiram para o banco (fila de escrita deste navegador). */
export function pendingWriteCount(): number {
  return Object.keys(loadOutbox()).length;
}

export function hasPendingWrites(): boolean {
  return Object.keys(loadOutbox()).length > 0;
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;
const rowResolvers = new Map<TableName, Array<(id: string) => Row | null>>();

// Cada serviço sabe ler do armazenamento local o registro que é dono; o
// repositório só sabe enviá-lo. Assim nenhum módulo precisa conhecer os outros.
// Uma mesma tabela aceita vários resolvedores (app_settings guarda tanto a
// tabela de planos quanto os tiers, e cada um vive no seu módulo).
export function registerRowResolver(table: TableName, fn: (id: string) => Row | null): void {
  const list = rowResolvers.get(table);
  if (list) list.push(fn);
  else rowResolvers.set(table, [fn]);
}

function resolveRow(table: TableName, id: string): Row | null {
  for (const fn of rowResolvers.get(table) ?? []) {
    const row = fn(id);
    if (row) return row;
  }
  return null;
}

export function queueWrite(table: TableName, id: string, op: PendingOp): void {
  const outbox = loadOutbox();
  outbox[`${table}:${id}`] = op;
  saveOutbox(outbox);
  scheduleFlush();
}

function scheduleFlush(): void {
  if (!supabase) return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingWrites();
  }, FLUSH_DEBOUNCE_MS);
}

// Escrita recusada por permissão (RLS) nunca vai passar por repetição — ao
// contrário de falha de rede. Precisa sair da fila, senão trava as próximas
// tentativas para sempre e o indicador de sync fica em erro eterno.
function isPermissionDenied(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42501') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('row-level security') || msg.includes('violates row-level');
}

// Envia tudo o que está pendente. Cada entrada só sai da fila quando o
// servidor confirma — falha de rede mantém a pendência para a próxima vez.
export async function flushPendingWrites(): Promise<{ sent: number; failed: number; denied: number }> {
  if (!supabase) return { sent: 0, failed: 0, denied: 0 };

  const outbox = loadOutbox();
  const keys = Object.keys(outbox);
  if (keys.length === 0) return { sent: 0, failed: 0, denied: 0 };

  let sent = 0;
  let failed = 0;
  let denied = 0;

  for (const key of keys) {
    const sep = key.indexOf(':');
    const table = key.slice(0, sep) as TableName;
    const id = key.slice(sep + 1);
    const op = outbox[key];

    try {
      if (op === 'delete') {
        const { error } = await supabase.from(table).delete().eq(table === 'app_settings' ? 'key' : 'id', id);
        if (error) throw error;
      } else {
        const row = resolveRow(table, id);
        if (!row) {
          // Registro sumiu do armazenamento local entre a fila e o envio:
          // nada a enviar, tira da fila para não travar as demais.
          delete outbox[key];
          continue;
        }
        const { error } = await supabase.from(table).upsert(row);
        if (error) throw error;
      }
      delete outbox[key];
      sent++;
    } catch (e) {
      if (isPermissionDenied(e)) {
        delete outbox[key];
        denied++;
        console.warn(`Sem permissão para ${op} em ${table}:${id} — alteração descartada (fora do seu escopo de acesso).`, e);
      } else {
        failed++;
        console.warn(`Falha ao enviar ${op} em ${table}:${id} (fica pendente para a próxima tentativa)`, e);
      }
    }
  }

  saveOutbox(outbox);
  return { sent, failed, denied };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export interface CloudSnapshot {
  partners: Partner[];
  referrals: Referral[];
  channelCosts: ChannelCostEntry[];
  newMrrEntries: NewMrrEntry[];
  settings: Record<string, unknown>;
}

async function fetchAllRows(table: TableName): Promise<Row[]> {
  if (!supabase) return [];
  const pageSize = 1000;
  const all: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

export async function fetchSnapshot(): Promise<CloudSnapshot | null> {
  if (!supabase) return null;

  const [partnerRows, referralRows, costRows, mrrRows, settingRows] = await Promise.all([
    fetchAllRows('partners'),
    fetchAllRows('referrals'),
    fetchAllRows('channel_costs'),
    fetchAllRows('new_mrr_entries'),
    fetchAllRows('app_settings')
  ]);

  const settings: Record<string, unknown> = {};
  for (const row of settingRows) settings[row.key as string] = row.value;

  return {
    partners: partnerRows.map(rowToPartner),
    referrals: referralRows.map(rowToReferral),
    channelCosts: costRows.map(rowToCost),
    newMrrEntries: mrrRows.map(rowToMrr),
    settings
  };
}

// ---------------------------------------------------------------------------
// Carga inicial: leva o que já existe (local + blob antigo) para as tabelas.
// ---------------------------------------------------------------------------

export async function seedTables(snapshot: {
  partners: Partner[];
  referrals: Referral[];
  channelCosts: ChannelCostEntry[];
  newMrrEntries: NewMrrEntry[];
}): Promise<void> {
  if (!supabase) return;

  const chunks = <T,>(list: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  };

  for (const batch of chunks(snapshot.partners.map(partnerToRow), 200)) {
    const { error } = await supabase.from('partners').upsert(batch);
    if (error) throw error;
  }
  for (const batch of chunks(snapshot.referrals.map(referralToRow), 100)) {
    const { error } = await supabase.from('referrals').upsert(batch);
    if (error) throw error;
  }
  if (snapshot.channelCosts.length > 0) {
    const { error } = await supabase.from('channel_costs').upsert(snapshot.channelCosts.map(costToRow));
    if (error) throw error;
  }
  if (snapshot.newMrrEntries.length > 0) {
    const { error } = await supabase.from('new_mrr_entries').upsert(snapshot.newMrrEntries.map(mrrToRow));
    if (error) throw error;
  }
}

export async function upsertSetting(key: string, value: unknown): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('app_settings').upsert({ key, value });
  if (error) throw error;
}
