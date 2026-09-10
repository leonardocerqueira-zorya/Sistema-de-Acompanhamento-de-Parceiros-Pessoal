import type { ChannelCostEntry, NewMrrEntry, Partner, Referral } from '../types';
import { supabase } from './supabaseClient';
import {
  fetchCloudBackup,
  loadStoredPartners,
  loadStoredReferrals,
  saveStoredPartners,
  saveStoredReferrals,
  pushBackupToSupabase
} from './storageService';
import {
  loadChannelCosts,
  saveChannelCosts,
  loadNewMrrEntries,
  saveNewMrrEntries
} from './channelMetricsService';
import {
  type TableName,
  fetchSnapshot,
  flushPendingWrites,
  pendingIdsFor,
  queueWrite,
  seedTables,
  upsertSetting,
  SETTING_MIGRATION_DONE,
  SETTING_PARTNER_TIERS,
  SETTING_PRICING_PLANS
} from './repository';
import { runWithoutTracking, setLocalChangeAt } from './syncState';

const FULL_SYNC_KEY = 'canal_ultimo_sync_completo';
const PLANS_STORAGE_KEY = 'zorya_custom_pricing_plans_v1';
const TIERS_STORAGE_KEY = 'zorya_partner_tiers_v1';

// ---------------------------------------------------------------------------
// Sincronização sobre tabelas relacionais.
//
// O banco é a fonte da verdade; o localStorage é cache, para a tela pintar na
// hora e o app aguentar oscilação de rede. Cada alteração sobe como upsert/
// delete da própria LINHA (ver repository.ts), então duas pessoas mexendo em
// registros diferentes nunca se sobrescrevem e apagar apaga de verdade.
//
// Regra de merge: o servidor manda, com duas exceções deliberadas —
//   1. id com escrita pendente (ainda não confirmada pelo servidor): a versão
//      local vence, senão uma edição feita offline seria apagada pela cópia
//      antiga que está no banco;
//   2. antes do primeiro sync completo deste navegador, registro que existe só
//      aqui é dado legado (de antes da migração) e sobe — depois do primeiro
//      sync completo, ausente no servidor significa apagado por alguém, e
//      some daqui também.
// ---------------------------------------------------------------------------

export type SyncStatus =
  | 'disabled'
  | 'empty'
  | 'migrated' // carga inicial: levou os dados existentes para as tabelas
  | 'merged'
  | 'up-to-date'
  | 'failed';

export interface SyncOutcome {
  status: SyncStatus;
  partnersFromCloud: number;
  referralsFromCloud: number;
  uploadedFromLocal: number;
  removedLocally: number;
  pendingFailures: number;
  deniedWrites: number; // alterações recusadas por falta de permissão
  message: string;
  error?: string;
}

function getLastFullSync(): string | null {
  try {
    return localStorage.getItem(FULL_SYNC_KEY);
  } catch {
    return null;
  }
}

function markFullSyncDone(): void {
  try {
    localStorage.setItem(FULL_SYNC_KEY, new Date().toISOString());
  } catch {
    /* sem armazenamento: o merge só fica mais conservador na próxima vez */
  }
}

interface MergeResult<T> {
  merged: T[];
  fromServer: number;
  uploaded: number;
  removed: number;
}

function mergeWithServer<T extends { id: string }>(
  table: TableName,
  local: T[],
  server: T[],
  hadFullSync: boolean
): MergeResult<T> {
  const pending = pendingIdsFor(table);
  const byId = new Map<string, T>();
  for (const item of server) if (item?.id) byId.set(item.id, item);

  const serverIds = new Set(byId.keys());
  const localIds = new Set<string>();
  let uploaded = 0;
  let removed = 0;

  for (const item of local) {
    if (!item?.id) continue;
    localIds.add(item.id);

    if (pending.has(item.id)) {
      // Alteração local ainda não confirmada: ela vence e já está na fila.
      byId.set(item.id, item);
      continue;
    }

    if (!serverIds.has(item.id)) {
      if (!hadFullSync) {
        // Dado anterior à migração: preserva e envia.
        byId.set(item.id, item);
        queueWrite(table, item.id, 'upsert');
        uploaded++;
      } else {
        // Já sincronizamos antes e o servidor não tem mais: foi apagado.
        removed++;
      }
    }
  }

  let fromServer = 0;
  for (const id of serverIds) if (!localIds.has(id)) fromServer++;

  return { merged: Array.from(byId.values()), fromServer, uploaded, removed };
}

// Na carga inicial, tabela de planos e tiers customizados existem só no
// navegador de quem editou. Se não subirem aqui, some a customização assim que
// outra pessoa gravar a dela — então vão junto com a migração.
async function seedLocalSettings(): Promise<void> {
  const read = (key: string): unknown => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  };

  const plans = read(PLANS_STORAGE_KEY);
  const tiers = read(TIERS_STORAGE_KEY);

  try {
    if (Array.isArray(plans) && plans.length > 0) await upsertSetting(SETTING_PRICING_PLANS, plans);
    if (Array.isArray(tiers) && tiers.length > 0) await upsertSetting(SETTING_PARTNER_TIERS, tiers);
  } catch (e) {
    console.warn('Não foi possível enviar planos/tiers na carga inicial:', e);
  }
}

function applySettings(settings: Record<string, unknown>): void {
  const write = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* configuração é acessória: sem espaço, segue com o padrão local */
    }
  };
  write(PLANS_STORAGE_KEY, settings[SETTING_PRICING_PLANS]);
  write(TIERS_STORAGE_KEY, settings[SETTING_PARTNER_TIERS]);
}

export async function syncWithCloud(): Promise<SyncOutcome> {
  const base = {
    partnersFromCloud: 0,
    referralsFromCloud: 0,
    uploadedFromLocal: 0,
    removedLocally: 0,
    pendingFailures: 0,
    deniedWrites: 0
  };

  if (!supabase) {
    return { ...base, status: 'disabled', message: 'Sincronização na nuvem não configurada.' };
  }

  try {
    // 1. Sobe o que ficou pendente antes de ler, para não baixar uma versão
    //    antiga por cima de uma edição que ainda não tinha saído daqui.
    const flushed = await flushPendingWrites();

    // 2. Lê as tabelas.
    const snapshot = await fetchSnapshot();
    if (!snapshot) {
      return { ...base, status: 'failed', message: 'Não foi possível ler os dados na nuvem.' };
    }

    const localPartners = loadStoredPartners();
    const localReferrals = loadStoredReferrals();
    const localCosts = loadChannelCosts();
    const localMrr = loadNewMrrEntries();

    // A migração é decidida por um marcador explícito, NUNCA por contagem de
    // linhas: com escopo por carteira no banco, um executivo sem parceiros
    // atribuídos enxerga zero linhas, e contar linhas concluiria — errado —
    // que o banco está vazio, disparando uma recarga em cima do que o time já
    // tem. Ver `migration_done` em supabase/schema_rls_scope.sql.
    const alreadyMigrated = snapshot.settings[SETTING_MIGRATION_DONE] !== undefined;

    // 3. Carga inicial: junta o que existe neste navegador com o backup antigo
    //    (blob) e leva tudo para o banco.
    if (!alreadyMigrated) {
      let seed = {
        partners: localPartners,
        referrals: localReferrals,
        channelCosts: localCosts,
        newMrrEntries: localMrr
      };

      try {
        const legacy = await fetchCloudBackup();
        if (legacy) {
          seed = {
            partners: unionById(localPartners, legacy.backup.partners || []),
            referrals: unionById(localReferrals, legacy.backup.referrals || []),
            channelCosts: unionById(localCosts, legacy.backup.channelCosts || []),
            newMrrEntries: unionById(localMrr, legacy.backup.newMrrEntries || [])
          };
        }
      } catch (e) {
        console.warn('Backup antigo não pôde ser lido na carga inicial (segue com os dados locais):', e);
      }

      const total = seed.partners.length + seed.referrals.length;
      if (total === 0) {
        return { ...base, status: 'empty', message: 'Nenhum dado para sincronizar ainda.' };
      }

      await seedTables(seed);
      await seedLocalSettings();
      try {
        await upsertSetting(SETTING_MIGRATION_DONE, { at: new Date().toISOString() });
      } catch (e) {
        console.warn('Não foi possível marcar a migração como concluída (só o master pode gravar):', e);
      }
      applyLocally(seed);
      markFullSyncDone();
      setLocalChangeAt(new Date().toISOString());

      return {
        ...base,
        status: 'migrated',
        uploadedFromLocal: total,
        message: `Dados migrados para o banco: ${seed.partners.length} parceiros e ${seed.referrals.length} indicações agora ficam em registros individuais.`
      };
    }

    // 4. Merge normal.
    const hadFullSync = getLastFullSync() !== null;

    const partners = mergeWithServer<Partner>('partners', localPartners, snapshot.partners, hadFullSync);
    const referrals = mergeWithServer<Referral>('referrals', localReferrals, snapshot.referrals, hadFullSync);
    const costs = mergeWithServer<ChannelCostEntry>('channel_costs', localCosts, snapshot.channelCosts, hadFullSync);
    const mrr = mergeWithServer<NewMrrEntry>('new_mrr_entries', localMrr, snapshot.newMrrEntries, hadFullSync);

    applyLocally({
      partners: partners.merged,
      referrals: referrals.merged,
      channelCosts: costs.merged,
      newMrrEntries: mrr.merged
    });
    applySettings(snapshot.settings);
    markFullSyncDone();

    const uploaded = partners.uploaded + referrals.uploaded + costs.uploaded + mrr.uploaded;
    const removed = partners.removed + referrals.removed + costs.removed + mrr.removed;
    const fromServer = partners.fromServer + referrals.fromServer;

    // Registros legados enfileirados agora: sobe já, sem esperar o debounce.
    if (uploaded > 0) await flushPendingWrites();

    const changed = fromServer > 0 || uploaded > 0 || removed > 0;

    return {
      ...base,
      status: changed ? 'merged' : 'up-to-date',
      partnersFromCloud: partners.fromServer,
      referralsFromCloud: referrals.fromServer,
      uploadedFromLocal: uploaded,
      removedLocally: removed,
      pendingFailures: flushed.failed,
      deniedWrites: flushed.denied,
      message: changed ? describeChanges(fromServer, uploaded, removed) : 'Dados já estavam sincronizados.'
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn('Sincronização falhou (dados seguem salvos neste navegador):', e);
    return {
      ...base,
      status: 'failed',
      message: 'Não foi possível sincronizar agora. Seus dados seguem salvos neste navegador e sobem sozinhos na próxima tentativa.',
      error
    };
  }
}

function describeChanges(fromServer: number, uploaded: number, removed: number): string {
  const parts: string[] = [];
  if (fromServer > 0) parts.push(`${fromServer} registro(s) recebido(s) do time`);
  if (uploaded > 0) parts.push(`${uploaded} enviado(s) deste navegador`);
  if (removed > 0) parts.push(`${removed} removido(s) por outra pessoa`);
  return `Dados sincronizados: ${parts.join(', ')}.`;
}

function unionById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of b) if (item?.id) byId.set(item.id, item);
  for (const item of a) if (item?.id) byId.set(item.id, item); // local vence
  return Array.from(byId.values());
}

// Grava o resultado do merge sem que isso conte como alteração do usuário —
// senão o que acabou de ser baixado voltaria pro servidor.
function applyLocally(data: {
  partners: Partner[];
  referrals: Referral[];
  channelCosts: ChannelCostEntry[];
  newMrrEntries: NewMrrEntry[];
}): void {
  runWithoutTracking(() => {
    saveStoredPartners(data.partners);
    saveStoredReferrals(data.referrals);
    saveChannelCosts(data.channelCosts);
    saveNewMrrEntries(data.newMrrEntries);
  });
}

// Sobe o que estiver pendente imediatamente (ex.: aba sendo fechada).
// O blob em system_backups segue sendo atualizado como backup de segurança.
export async function flushToCloud(): Promise<void> {
  if (!supabase) return;
  try {
    await flushPendingWrites();
    await pushBackupToSupabase();
  } catch (e) {
    console.warn('Envio final falhou:', e);
  }
}
