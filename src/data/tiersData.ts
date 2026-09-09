// Tiers do programa de parceiros — editáveis pelo Master em Configurações.
// "Embaixador Zorya" é o único tier com efeito funcional: parceiros com
// Partner.ambassadorId apontando para um parceiro desse tier geram comissão
// extra pro embaixador nas indicações fechadas (ver commissionLogic.ts).
export const DEFAULT_PARTNER_TIERS: string[] = [
  'Parceiro Zorya',
  'Growth',
  'Estratégico',
  'Embaixador Zorya'
];

const TIERS_STORAGE_KEY = 'zorya_partner_tiers_v1';

export function loadStoredPartnerTiers(): string[] {
  try {
    const raw = localStorage.getItem(TIERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler tiers de parceiros do localStorage', e);
  }
  return DEFAULT_PARTNER_TIERS;
}

export function saveStoredPartnerTiers(tiers: string[]): void {
  try {
    localStorage.setItem(TIERS_STORAGE_KEY, JSON.stringify(tiers));
  } catch (e) {
    console.error('Erro ao salvar tiers de parceiros no localStorage', e);
  }
}

export function resetStoredPartnerTiers(): string[] {
  try {
    localStorage.removeItem(TIERS_STORAGE_KEY);
  } catch (e) {
    console.error('Erro ao restaurar tiers padrão', e);
  }
  return DEFAULT_PARTNER_TIERS;
}
