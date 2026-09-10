import type { AppNotification, ChannelCostEntry, NewMrrEntry, Partner, Referral } from '../types';
import { supabase } from './supabaseClient';
import {
  type SystemBackup,
  importAllData,
  loadStoredPartners,
  loadStoredReferrals,
  fetchCloudBackup,
  pushBackupToSupabase
} from './storageService';
import { loadChannelCosts, loadNewMrrEntries } from './channelMetricsService';
import { getLocalChangeAt, setLocalChangeAt, runWithoutTracking } from './syncState';

const NOTIFICATIONS_STORAGE_KEY = 'canal_notificacoes_v1';

// ---------------------------------------------------------------------------
// Sincronização entre máquinas.
//
// O app continua offline-first (localStorage é lido primeiro e sempre funciona),
// mas agora a nuvem é reconciliada de verdade: ao abrir o sistema (e ao voltar
// o foco pra aba), o backup da nuvem é baixado e MESCLADO com o local por id.
//
// Regra central, pensada pra não perder dados: a mesclagem é uma UNIÃO. Todo
// registro que existe em qualquer um dos lados sobrevive. Só quando o MESMO id
// existe nos dois lados com conteúdo diferente é que há decisão a tomar — e aí
// vale o mais recente (por updatedAt do próprio registro quando existe, senão
// pelo lado que foi alterado por último).
//
// Limitação conhecida: sem "tombstones" (marca de exclusão), um registro
// apagado numa máquina pode voltar se outra máquina ainda o tiver. No domínio
// deste app isso é raro — parceiro vira `inativo` e indicação vira `perdido`,
// em vez de serem removidos da lista.
// ---------------------------------------------------------------------------

export type SyncStatus =
  | 'disabled' // Supabase não configurado
  | 'empty' // nada local, nada na nuvem
  | 'bootstrapped' // nuvem estava vazia: subiu o local como primeira cópia
  | 'adopted' // navegador novo/zerado: adotou a nuvem inteira
  | 'merged' // os dois lados tinham dados: mesclou e reconciliou
  | 'up-to-date' // já estavam idênticos
  | 'failed';

export interface SyncOutcome {
  status: SyncStatus;
  partnersFromCloud: number; // registros que só existiam na nuvem
  referralsFromCloud: number;
  partnersOnlyLocal: number; // registros que só existiam aqui (foram preservados e subiram)
  referralsOnlyLocal: number;
  conflicts: number; // mesmo id divergente nos dois lados
  message: string;
  error?: string;
}

interface MergeStats {
  fromCloudOnly: number;
  fromLocalOnly: number;
  conflicts: number;
}

function sameContent(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Mescla duas listas de registros com `id`, em união.
// `preferCloud` só decide empates em que não há timestamp por registro.
export function mergeRecords<T extends { id: string }>(
  local: T[],
  cloud: T[],
  preferCloud: boolean,
  recencyOf?: (item: T) => string | undefined
): { merged: T[]; stats: MergeStats } {
  const localById = new Map<string, T>();
  for (const item of local) if (item && item.id) localById.set(item.id, item);
  const cloudById = new Map<string, T>();
  for (const item of cloud) if (item && item.id) cloudById.set(item.id, item);

  const merged = new Map<string, T>();
  const stats: MergeStats = { fromCloudOnly: 0, fromLocalOnly: 0, conflicts: 0 };

  for (const [id, localItem] of localById) {
    const cloudItem = cloudById.get(id);

    if (!cloudItem) {
      stats.fromLocalOnly++;
      merged.set(id, localItem);
      continue;
    }

    if (sameContent(localItem, cloudItem)) {
      merged.set(id, localItem);
      continue;
    }

    stats.conflicts++;
    const localAt = recencyOf?.(localItem);
    const cloudAt = recencyOf?.(cloudItem);
    if (localAt && cloudAt) {
      merged.set(id, cloudAt > localAt ? cloudItem : localItem);
    } else if (cloudAt && !localAt) {
      merged.set(id, cloudItem);
    } else if (localAt && !cloudAt) {
      merged.set(id, localItem);
    } else {
      merged.set(id, preferCloud ? cloudItem : localItem);
    }
  }

  for (const [id, cloudItem] of cloudById) {
    if (merged.has(id)) continue;
    stats.fromCloudOnly++;
    merged.set(id, cloudItem);
  }

  return { merged: Array.from(merged.values()), stats };
}

function loadLocalNotifications(): AppNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppNotification[];
  } catch {
    /* notificações são acessórias: se ilegíveis, segue com lista vazia */
  }
  return [];
}

// Escreve um backup no armazenamento local sem contar como alteração do
// usuário (senão o merge acharia que este navegador é o lado mais fresco).
function applyBackupLocally(backup: SystemBackup): void {
  runWithoutTracking(() => {
    importAllData(JSON.stringify(backup));
  });
}

function describeMerge(o: Omit<SyncOutcome, 'message'>): string {
  const parts: string[] = [];
  const baixados = o.partnersFromCloud + o.referralsFromCloud;
  const enviados = o.partnersOnlyLocal + o.referralsOnlyLocal;
  if (baixados > 0) parts.push(`${baixados} registro(s) baixado(s) da nuvem`);
  if (enviados > 0) parts.push(`${enviados} registro(s) deste navegador enviado(s)`);
  if (o.conflicts > 0) parts.push(`${o.conflicts} atualizado(s) para a versão mais recente`);
  return parts.length > 0 ? `Dados sincronizados: ${parts.join(', ')}.` : 'Dados já estavam sincronizados.';
}

export async function syncWithCloud(): Promise<SyncOutcome> {
  const base: Omit<SyncOutcome, 'status' | 'message'> = {
    partnersFromCloud: 0,
    referralsFromCloud: 0,
    partnersOnlyLocal: 0,
    referralsOnlyLocal: 0,
    conflicts: 0
  };

  if (!supabase) {
    return { ...base, status: 'disabled', message: 'Sincronização na nuvem não configurada.' };
  }

  try {
    const cloudRow = await fetchCloudBackup();
    const localPartners = loadStoredPartners();
    const localReferrals = loadStoredReferrals();
    const localIsEmpty = localPartners.length === 0 && localReferrals.length === 0;
    const localChangeAt = getLocalChangeAt();

    // Nuvem ainda vazia: este navegador vira a primeira cópia compartilhada.
    if (!cloudRow) {
      if (localIsEmpty) {
        return { ...base, status: 'empty', message: 'Nenhum dado local nem na nuvem.' };
      }
      await pushBackupToSupabase();
      setLocalChangeAt(new Date().toISOString());
      return {
        ...base,
        status: 'bootstrapped',
        partnersOnlyLocal: localPartners.length,
        referralsOnlyLocal: localReferrals.length,
        message: 'Primeira cópia enviada para a nuvem — o time já pode acessar destes dados.'
      };
    }

    const cloud = cloudRow.backup;

    // Navegador/máquina nova (nunca teve dado nem alteração local): adota a
    // nuvem inteira. É o caso mais comum ao liberar o sistema para o time.
    if (localIsEmpty && !localChangeAt) {
      applyBackupLocally(cloud);
      setLocalChangeAt(cloudRow.updatedAt);
      return {
        ...base,
        status: 'adopted',
        partnersFromCloud: (cloud.partners || []).length,
        referralsFromCloud: (cloud.referrals || []).length,
        message: `Dados carregados da nuvem: ${(cloud.partners || []).length} parceiros e ${(cloud.referrals || []).length} indicações.`
      };
    }

    // Os dois lados têm conteúdo: mescla. `preferCloud` só desempata registros
    // sem timestamp próprio — a união preserva tudo o mais.
    //
    // Sem timestamp local (primeira abertura depois desta atualização) não há
    // como saber qual lado é mais fresco. Nesse caso mantém-se o que a pessoa
    // já vê na tela, em vez de reverter silenciosamente o trabalho dela para
    // uma versão da nuvem de origem desconhecida.
    const preferCloud = localChangeAt ? cloudRow.updatedAt > localChangeAt : false;

    const partners = mergeRecords<Partner>(localPartners, cloud.partners || [], preferCloud);
    const referrals = mergeRecords<Referral>(localReferrals, cloud.referrals || [], preferCloud);
    const costs = mergeRecords<ChannelCostEntry>(
      loadChannelCosts(),
      cloud.channelCosts || [],
      preferCloud,
      e => e.updatedAt
    );
    const mrr = mergeRecords<NewMrrEntry>(
      loadNewMrrEntries(),
      cloud.newMrrEntries || [],
      preferCloud,
      e => e.updatedAt
    );
    const notifications = mergeRecords<AppNotification>(
      loadLocalNotifications(),
      (cloud.notifications || []) as AppNotification[],
      preferCloud,
      n => n.timestamp
    );

    const changed =
      partners.stats.fromCloudOnly > 0 ||
      partners.stats.conflicts > 0 ||
      referrals.stats.fromCloudOnly > 0 ||
      referrals.stats.conflicts > 0 ||
      costs.stats.fromCloudOnly > 0 ||
      costs.stats.conflicts > 0 ||
      mrr.stats.fromCloudOnly > 0 ||
      mrr.stats.conflicts > 0 ||
      notifications.stats.fromCloudOnly > 0;

    const localHasExtras =
      partners.stats.fromLocalOnly > 0 ||
      referrals.stats.fromLocalOnly > 0 ||
      costs.stats.fromLocalOnly > 0 ||
      mrr.stats.fromLocalOnly > 0;

    if (!changed && !localHasExtras) {
      return { ...base, status: 'up-to-date', message: 'Dados já estavam sincronizados.' };
    }

    const mergedBackup: SystemBackup = {
      schema: 'canal-parcerias-backup',
      version: 3,
      exportedAt: new Date().toISOString(),
      partners: partners.merged,
      referrals: referrals.merged,
      notifications: notifications.merged,
      channelCosts: costs.merged,
      newMrrEntries: mrr.merged
    };

    if (changed) {
      applyBackupLocally(mergedBackup);
    }

    // Reconcilia a nuvem com a união (inclusive o que só existia aqui).
    await pushBackupToSupabase();
    setLocalChangeAt(new Date().toISOString());

    const outcome: Omit<SyncOutcome, 'message'> = {
      status: 'merged',
      partnersFromCloud: partners.stats.fromCloudOnly,
      referralsFromCloud: referrals.stats.fromCloudOnly,
      partnersOnlyLocal: partners.stats.fromLocalOnly,
      referralsOnlyLocal: referrals.stats.fromLocalOnly,
      conflicts: partners.stats.conflicts + referrals.stats.conflicts + costs.stats.conflicts + mrr.stats.conflicts
    };

    return { ...outcome, message: describeMerge(outcome) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn('Sincronização com a nuvem falhou (dados seguem salvos localmente):', e);
    return {
      ...base,
      status: 'failed',
      message: 'Não foi possível sincronizar com a nuvem agora. Seus dados seguem salvos neste navegador.',
      error
    };
  }
}

// Envia o estado local pra nuvem imediatamente (sem esperar o debounce).
// Usado ao sair do app/fechar a aba para não perder a última alteração.
export async function flushToCloud(): Promise<void> {
  if (!supabase) return;
  try {
    await pushBackupToSupabase();
  } catch (e) {
    console.warn('Envio final para a nuvem falhou:', e);
  }
}
