import type { AccessState, Partner, Referral } from '../types';

const ACCESS_STORAGE_KEY = 'canal_access_v1';

// Default: master (para o backfill inicial). Ao migrar para Supabase, o papel virá do usuário autenticado (RLS).
export const DEFAULT_ACCESS: AccessState = {
  role: 'master',
  executive: null
};

export function loadAccess(): AccessState {
  try {
    const raw = localStorage.getItem(ACCESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccessState>;
      const role = parsed.role === 'executivo' ? 'executivo' : 'master';
      return {
        role,
        executive: role === 'executivo' ? (parsed.executive || null) : null
      };
    }
  } catch (e) {
    console.error('Erro ao ler o acesso do localStorage', e);
  }
  return DEFAULT_ACCESS;
}

export function saveAccess(access: AccessState): void {
  try {
    localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(access));
  } catch (e) {
    console.error('Erro ao salvar o acesso no localStorage', e);
  }
}

export function isMaster(access: AccessState): boolean {
  return access.role === 'master';
}

// Normaliza o nome do executivo para comparação (case/acentos triviais)
function normExec(name: string | null | undefined): string {
  return (name || '').trim().toLowerCase();
}

// Lista de executivos distintos derivada dos parceiros (accountOwner = executivo interno dono da carteira).
export function listExecutives(partners: Partner[]): string[] {
  const set = new Map<string, string>();
  partners.forEach(p => {
    const name = (p.accountOwner || '').trim();
    if (name) set.set(name.toLowerCase(), name);
  });
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

// Parceiros visíveis para o acesso atual (carteira do executivo, ou todos para master).
export function scopePartnersForAccess(partners: Partner[], access: AccessState): Partner[] {
  if (access.role === 'master' || !access.executive) return partners;
  const exec = normExec(access.executive);
  return partners.filter(p => normExec(p.accountOwner) === exec);
}

// Indicações visíveis para o acesso atual: apenas as dos parceiros da carteira do executivo.
export function scopeReferralsForAccess(
  referrals: Referral[],
  partners: Partner[],
  access: AccessState
): Referral[] {
  if (access.role === 'master' || !access.executive) return referrals;
  const visiblePartnerIds = new Set(scopePartnersForAccess(partners, access).map(p => p.id));
  return referrals.filter(r => visiblePartnerIds.has(r.partnerId));
}
