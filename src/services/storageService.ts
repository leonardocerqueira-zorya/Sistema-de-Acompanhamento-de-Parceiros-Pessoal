import type { Partner, Referral, ChannelCostEntry, NewMrrEntry } from '../types';
import { evaluateMissingFields } from './sheetsService';
import { supabase } from './supabaseClient';
import { loadChannelCosts, saveChannelCosts, loadNewMrrEntries, saveNewMrrEntries } from './channelMetricsService';
import { markLocalChange, registerCloudPush, runWithoutTracking } from './syncState';

const PARTNERS_STORAGE_KEY = 'parceiros_data_v2';
const REFERRALS_STORAGE_KEY = 'indicacoes_data_v2';
const LEGACY_PARTNERS_KEY = 'parceiros_data_v1';
const LEGACY_REFERRALS_KEY = 'indicacoes_data_v1';

// No fictitious/mock data: start clean and authentic
const INITIAL_PARTNERS: Partner[] = [];
const INITIAL_REFERRALS_RAW: Omit<Referral, 'hasMissingData' | 'missingFields'>[] = [];

// Check if a partner is from the old fictitious/mock seed
export function isFictitiousPartner(p: Partner): boolean {
  return ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6'].includes(p.id) ||
    p.name.includes('AlphaTech') ||
    p.name.includes('Growth Hub') ||
    p.name.includes('Vanguarda B2B') ||
    p.name.includes('Studio Prime') ||
    p.name.includes('Nexus Consultores') ||
    p.name.includes('Duarte & Cia');
}

// Check if a referral is from the old fictitious/mock seed
export function isFictitiousReferral(r: Referral): boolean {
  return (
    r.id.startsWith('ref-10') ||
    r.id.startsWith('ref-11') ||
    r.clientName.includes('Varejo Brasil') ||
    r.clientName.includes('TransNacional') ||
    r.clientName.includes('Solaris Crédito') ||
    r.clientName.includes('Horizon') ||
    r.clientName.includes('Moda Viva') ||
    r.clientName.includes('Distribuidora Aliança') ||
    r.clientName.includes('Coworking Hub Central') ||
    r.clientName.includes('Metalúrgica Forte') ||
    r.clientName.includes('Saúde Integrada') ||
    r.clientName.includes('BioNutri') ||
    r.clientName.includes('Horizonte Azul') ||
    r.clientName.includes('FarmaMais')
  );
}

// Initialize and evaluate missing fields on each initial referral
export function getInitialReferrals(): Referral[] {
  return INITIAL_REFERRALS_RAW.map(ref => {
    const missingFields = evaluateMissingFields(ref);
    return {
      ...ref,
      hasMissingData: missingFields.length > 0,
      missingFields
    };
  });
}

// Local Storage Handlers
export function loadStoredPartners(): Partner[] {
  try {
    // Purge legacy storage keys that had fictitious mock data
    if (localStorage.getItem(LEGACY_PARTNERS_KEY)) {
      localStorage.removeItem(LEGACY_PARTNERS_KEY);
    }
    const raw = localStorage.getItem(PARTNERS_STORAGE_KEY);
    if (raw) {
      const parsed: Partner[] = JSON.parse(raw);
      // Filter out any mock/fictitious items if present
      const clean = parsed.filter(p => !isFictitiousPartner(p));
      if (clean.length !== parsed.length) {
        saveStoredPartners(clean);
      }
      return clean;
    }
  } catch (e) {
    console.error('Erro ao ler parceiros do localStorage', e);
  }
  // Gravar o padrao vazio nao e alteracao do usuario: se marcasse alteracao,
  // um navegador novo poderia empurrar uma copia vazia pra nuvem antes de o
  // merge baixar os dados do time.
  runWithoutTracking(() => saveStoredPartners(INITIAL_PARTNERS));
  return INITIAL_PARTNERS;
}

export function saveStoredPartners(partners: Partner[]): void {
  try {
    localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(partners));
  } catch (e) {
    console.error('Erro ao salvar parceiros no localStorage', e);
  }
  markLocalChange();
}

export function loadStoredReferrals(): Referral[] {
  try {
    // Purge legacy storage keys that had fictitious mock data
    if (localStorage.getItem(LEGACY_REFERRALS_KEY)) {
      localStorage.removeItem(LEGACY_REFERRALS_KEY);
    }
    const raw = localStorage.getItem(REFERRALS_STORAGE_KEY);
    if (raw) {
      const list: Referral[] = JSON.parse(raw);
      // Filter out any mock/fictitious items
      const clean = list.filter(r => !isFictitiousReferral(r));
      // Re-evaluate missing fields dynamically
      const evaluated = clean.map(item => {
        const missingFields = evaluateMissingFields(item);
        return {
          ...item,
          hasMissingData: missingFields.length > 0,
          missingFields
        };
      });
      if (clean.length !== list.length) {
        saveStoredReferrals(evaluated);
      }
      return evaluated;
    }
  } catch (e) {
    console.error('Erro ao ler indicações do localStorage', e);
  }
  const initial = getInitialReferrals();
  runWithoutTracking(() => saveStoredReferrals(initial));
  return initial;
}

export function saveStoredReferrals(referrals: Referral[]): void {
  try {
    localStorage.setItem(REFERRALS_STORAGE_KEY, JSON.stringify(referrals));
  } catch (e) {
    console.error('Erro ao salvar indicações no localStorage', e);
  }
  markLocalChange();
}

// Clear all data to completely start clean
export function clearAllSystemData(): { partners: Partner[]; referrals: Referral[] } {
  saveStoredPartners([]);
  saveStoredReferrals([]);
  return { partners: [], referrals: [] };
}

// ---------------------------------------------------------------------------
// Backup & Restore (proteção do backfill enquanto a persistência é local).
// Exporta/importa o estado completo como um único arquivo JSON portável entre
// navegadores/máquinas. Ao migrar para o Supabase, este mesmo formato serve de
// semente para a carga inicial no banco.
// ---------------------------------------------------------------------------

const NOTIFICATIONS_STORAGE_KEY = 'canal_notificacoes_v1';

export interface SystemBackup {
  schema: 'canal-parcerias-backup';
  version: number;
  exportedAt: string;
  partners: Partner[];
  referrals: Referral[];
  notifications: unknown[];
  channelCosts?: ChannelCostEntry[]; // custos do canal por mês (v3+)
  newMrrEntries?: NewMrrEntry[]; // novo MRR total + canais de origem por mês (v3+)
}

export function exportAllData(): string {
  let notifications: unknown[] = [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (raw) notifications = JSON.parse(raw);
  } catch {
    notifications = [];
  }

  const backup: SystemBackup = {
    schema: 'canal-parcerias-backup',
    version: 3,
    exportedAt: new Date().toISOString(),
    partners: loadStoredPartners(),
    referrals: loadStoredReferrals(),
    notifications,
    channelCosts: loadChannelCosts(),
    newMrrEntries: loadNewMrrEntries()
  };
  return JSON.stringify(backup, null, 2);
}

export interface ImportResult {
  partners: Partner[];
  referrals: Referral[];
  ok: boolean;
  message: string;
}

export function importAllData(json: string): ImportResult {
  let parsed: Partial<SystemBackup>;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { partners: [], referrals: [], ok: false, message: 'Arquivo inválido: não é um JSON válido.' };
  }

  if (!parsed || !Array.isArray(parsed.partners) || !Array.isArray(parsed.referrals)) {
    return {
      partners: [],
      referrals: [],
      ok: false,
      message: 'Arquivo não reconhecido: faltam as listas de parceiros e/ou indicações.'
    };
  }

  const partners = parsed.partners as Partner[];
  // Re-evaluate missing fields on import to keep audit flags consistent with the current rules.
  const referrals = (parsed.referrals as Referral[]).map(item => {
    const missingFields = evaluateMissingFields(item);
    return { ...item, hasMissingData: missingFields.length > 0, missingFields };
  });

  saveStoredPartners(partners);
  saveStoredReferrals(referrals);

  if (Array.isArray(parsed.notifications)) {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(parsed.notifications));
    } catch {
      /* ignore notification restore errors */
    }
  }

  // Campos v3+: ausentes num backup antigo (v2) não apagam o que já existe localmente.
  if (Array.isArray(parsed.channelCosts)) {
    saveChannelCosts(parsed.channelCosts as ChannelCostEntry[]);
  }
  if (Array.isArray(parsed.newMrrEntries)) {
    saveNewMrrEntries(parsed.newMrrEntries as NewMrrEntry[]);
  }

  return {
    partners,
    referrals,
    ok: true,
    message: `Backup restaurado: ${partners.length} parceiros e ${referrals.length} indicações.`
  };
}

// ---------------------------------------------------------------------------
// Espelho na nuvem (Supabase).
// localStorage segue sendo lido primeiro (o app funciona offline), mas a nuvem
// é a cópia compartilhada do time: cada save local sobe o mesmo formato do
// backup (SystemBackup) em segundo plano, e o syncService baixa e mescla essa
// cópia ao abrir o app. Falha de rede nunca quebra o uso local.
// ---------------------------------------------------------------------------

const CLOUD_BACKUP_TABLE = 'system_backups';
const CLOUD_BACKUP_ROW_ID = 'main';

export async function pushBackupToSupabase(): Promise<void> {
  if (!supabase) return;
  const backup = JSON.parse(exportAllData()) as SystemBackup;
  const { error } = await supabase
    .from(CLOUD_BACKUP_TABLE)
    .upsert({ id: CLOUD_BACKUP_ROW_ID, data: backup, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export interface CloudBackupRow {
  backup: SystemBackup;
  updatedAt: string; // quando a nuvem foi atualizada pela última vez (por qualquer máquina)
}

// Baixa a cópia compartilhada junto do seu timestamp — é o timestamp que diz
// ao merge se a nuvem tem alterações mais novas que as deste navegador.
export async function fetchCloudBackup(): Promise<CloudBackupRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(CLOUD_BACKUP_TABLE)
    .select('data, updated_at')
    .eq('id', CLOUD_BACKUP_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data?.data) return null;
  return {
    backup: data.data as SystemBackup,
    updatedAt: (data.updated_at as string) ?? new Date(0).toISOString()
  };
}

// O rastreador de alterações locais (módulo folha) não conhece o Supabase:
// é aqui que o push real é ligado ao debounce dele.
registerCloudPush(pushBackupToSupabase);
