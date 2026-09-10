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

function undef<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

function numOrUndef(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Mapeamento domínio <-> linha
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

export function partnerToRow(p: Partner): Row {
  return {
    id: p.id,
    id_conexa: p.idConexa ?? null,
    document: p.document ?? null,
    name: p.name,
    profile: p.profile ?? null,
    tier: p.tier ?? null,
    ambassador_id: p.ambassadorId ?? null,
    responsible_person: p.responsiblePerson ?? null,
    account_owner: p.accountOwner ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    company: p.company ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    joined_date: p.joinedDate ?? null,
    status: p.status,
    has_signed_contract: p.hasSignedContract ?? null,
    notes: p.notes ?? null
  };
}

export function rowToPartner(r: Row): Partner {
  return {
    id: String(r.id),
    idConexa: undef(r.id_conexa as string),
    document: undef(r.document as string),
    name: (r.name as string) ?? '',
    profile: undef(r.profile as Partner['profile']),
    tier: undef(r.tier as string),
    ambassadorId: undef(r.ambassador_id as string),
    responsiblePerson: undef(r.responsible_person as string),
    accountOwner: undef(r.account_owner as string),
    email: undef(r.email as string),
    phone: undef(r.phone as string),
    company: undef(r.company as string),
    city: undef(r.city as string),
    state: undef(r.state as string),
    joinedDate: undef(r.joined_date as string),
    status: (r.status as Partner['status']) ?? 'ativo',
    hasSignedContract: undef(r.has_signed_contract as boolean),
    notes: undef(r.notes as string)
  };
}

export function referralToRow(r: Referral): Row {
  return {
    id: r.id,
    id_conexa: r.idConexa ?? null,
    partner_id: r.partnerId,
    partner_name: r.partnerName ?? null,
    client_name: r.clientName ?? null,
    client_document: r.clientDocument ?? null,
    responsible_person: r.responsiblePerson ?? null,
    client_company: r.clientCompany ?? null,
    client_email: r.clientEmail ?? null,
    client_phone: r.clientPhone ?? null,
    referral_date: r.referralDate ?? null,
    deal_status: r.dealStatus,
    plan_id: r.planId ?? null,
    plan_recurrence: r.planRecurrence ?? null,
    plan_installments: r.planInstallments ?? null,
    mrr_gross: r.mrrGross ?? null,
    discount_percent: r.discountPercent ?? null,
    discount_value: r.discountValue ?? null,
    mrr_net: r.mrrNet ?? null,
    deal_value: r.dealValue ?? null,
    gross_deal_value: r.grossDealValue ?? null,
    close_date: r.closeDate ?? null,
    invoice_due_day: r.invoiceDueDay ?? null,
    first_invoice_due_date: r.firstInvoiceDueDate ?? null,
    commission_percent: r.commissionPercent ?? null,
    commission_value: r.commissionValue ?? null,
    commission_status: r.commissionStatus ?? null,
    commission_paid_date: r.commissionPaidDate ?? null,
    payment_method: r.paymentMethod ?? null,
    notes: r.notes ?? null,
    commission_installments: r.commissionInstallments ?? [],
    ambassador_id: r.ambassadorId ?? null,
    ambassador_name: r.ambassadorName ?? null,
    ambassador_commission_status: r.ambassadorCommissionStatus ?? null,
    ambassador_commission_installments: r.ambassadorCommissionInstallments ?? [],
    is_placeholder: r.isPlaceholder ?? false
  };
}

export function rowToReferral(r: Row): Referral {
  return {
    id: String(r.id),
    idConexa: undef(r.id_conexa as string),
    partnerId: (r.partner_id as string) ?? '',
    partnerName: (r.partner_name as string) ?? '',
    clientName: (r.client_name as string) ?? '',
    clientDocument: undef(r.client_document as string),
    responsiblePerson: undef(r.responsible_person as string),
    clientCompany: undef(r.client_company as string),
    clientEmail: undef(r.client_email as string),
    clientPhone: undef(r.client_phone as string),
    referralDate: undef(r.referral_date as string),
    dealStatus: (r.deal_status as Referral['dealStatus']) ?? 'novo',
    planId: undef(r.plan_id as string),
    planRecurrence: undef(r.plan_recurrence as Referral['planRecurrence']),
    planInstallments: undef(r.plan_installments as Referral['planInstallments']),
    mrrGross: numOrUndef(r.mrr_gross),
    discountPercent: numOrUndef(r.discount_percent),
    discountValue: numOrUndef(r.discount_value),
    mrrNet: numOrUndef(r.mrr_net),
    dealValue: numOrUndef(r.deal_value),
    grossDealValue: numOrUndef(r.gross_deal_value),
    closeDate: undef(r.close_date as string),
    invoiceDueDay: numOrUndef(r.invoice_due_day),
    firstInvoiceDueDate: undef(r.first_invoice_due_date as string),
    commissionPercent: numOrUndef(r.commission_percent),
    commissionValue: numOrUndef(r.commission_value),
    commissionStatus: (r.commission_status as Referral['commissionStatus']) ?? 'pendente_fechamento',
    commissionPaidDate: undef(r.commission_paid_date as string),
    paymentMethod: undef(r.payment_method as string),
    notes: undef(r.notes as string),
    commissionInstallments: (r.commission_installments as CommissionInstallment[]) ?? [],
    ambassadorId: undef(r.ambassador_id as string),
    ambassadorName: undef(r.ambassador_name as string),
    ambassadorCommissionStatus: undef(r.ambassador_commission_status as Referral['ambassadorCommissionStatus']),
    ambassadorCommissionInstallments: (r.ambassador_commission_installments as CommissionInstallment[]) ?? [],
    isPlaceholder: (r.is_placeholder as boolean) ?? false
  };
}

export function costToRow(e: ChannelCostEntry): Row {
  return { id: e.id, period: e.period, total_cost: e.totalCost, notes: e.notes ?? null };
}

export function rowToCost(r: Row): ChannelCostEntry {
  return {
    id: String(r.id),
    period: r.period as string,
    totalCost: numOrUndef(r.total_cost) ?? 0,
    notes: undef(r.notes as string),
    updatedAt: (r.updated_at as string) ?? new Date().toISOString()
  };
}

export function mrrToRow(e: NewMrrEntry): Row {
  return {
    id: e.id,
    period: e.period,
    total_new_mrr: e.totalNewMrr,
    total_new_deals_count: e.totalNewDealsCount ?? null,
    other_channels: e.otherChannels ?? [],
    notes: e.notes ?? null
  };
}

export function rowToMrr(r: Row): NewMrrEntry {
  return {
    id: String(r.id),
    period: r.period as string,
    totalNewMrr: numOrUndef(r.total_new_mrr) ?? 0,
    totalNewDealsCount: numOrUndef(r.total_new_deals_count),
    otherChannels: (r.other_channels as MrrChannelBreakdownItem[]) ?? [],
    notes: undef(r.notes as string),
    updatedAt: (r.updated_at as string) ?? new Date().toISOString()
  };
}

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
