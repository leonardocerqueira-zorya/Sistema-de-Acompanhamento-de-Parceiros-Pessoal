import type { Partner, Referral } from '../types';
import { evaluateMissingFields } from './sheetsService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

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
  saveStoredPartners(INITIAL_PARTNERS);
  return INITIAL_PARTNERS;
}

export function saveStoredPartners(partners: Partner[]): void {
  try {
    localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(partners));
  } catch (e) {
    console.error('Erro ao salvar parceiros no localStorage', e);
  }
  scheduleCloudBackupSync();
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
  saveStoredReferrals(initial);
  return initial;
}

export function saveStoredReferrals(referrals: Referral[]): void {
  try {
    localStorage.setItem(REFERRALS_STORAGE_KEY, JSON.stringify(referrals));
  } catch (e) {
    console.error('Erro ao salvar indicações no localStorage', e);
  }
  scheduleCloudBackupSync();
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
    version: 2,
    exportedAt: new Date().toISOString(),
    partners: loadStoredPartners(),
    referrals: loadStoredReferrals(),
    notifications
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

  return {
    partners,
    referrals,
    ok: true,
    message: `Backup restaurado: ${partners.length} parceiros e ${referrals.length} indicações.`
  };
}

// ---------------------------------------------------------------------------
// Espelho na nuvem (Supabase) -- opcional e best-effort.
// localStorage continua sendo a fonte da verdade e o app funciona 100% offline;
// se o Supabase estiver configurado (ver supabaseClient.ts), cada save local
// também empurra o mesmo formato do backup (SystemBackup) pra nuvem, em segundo
// plano, sem bloquear a UI e sem quebrar nada se a rede/Supabase falhar.
// ---------------------------------------------------------------------------

const CLOUD_BACKUP_TABLE = 'system_backups';
const CLOUD_BACKUP_ROW_ID = 'main';
const CLOUD_SYNC_DEBOUNCE_MS = 1500;

let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCloudBackupSync(): void {
  if (!isSupabaseConfigured) return;
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    pushBackupToSupabase().catch(e => console.warn('Sync com Supabase falhou (dados seguem salvos localmente):', e));
  }, CLOUD_SYNC_DEBOUNCE_MS);
}

export async function pushBackupToSupabase(): Promise<void> {
  if (!supabase) return;
  const backup = JSON.parse(exportAllData()) as SystemBackup;
  const { error } = await supabase
    .from(CLOUD_BACKUP_TABLE)
    .upsert({ id: CLOUD_BACKUP_ROW_ID, data: backup, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function pullBackupFromSupabase(): Promise<SystemBackup | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(CLOUD_BACKUP_TABLE)
    .select('data')
    .eq('id', CLOUD_BACKUP_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return (data?.data as SystemBackup) ?? null;
}
