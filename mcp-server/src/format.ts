import type { StatSummary } from '../../src/utils/statistics';

// ---------------------------------------------------------------------------
// Enxugar o retorno antes de mandar para o modelo.
//
// Os tipos do app carregam listas inteiras de indicações dentro de cada safra
// (ReferralVintage.referrals, PartnerVintage.members). Isso serve para a tela
// desenhar o drill-down, e seria desperdício de contexto aqui — além de tentar
// o modelo a recontar à mão o que a função já contou.
// ---------------------------------------------------------------------------

/** Dinheiro e medidas contínuas: 2 casas. */
export function n2(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
}

/** Percentuais e dias: 1 casa basta e economiza contexto. */
export function n1(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
}

/** StatSummary em português e compacto. `n` é quantos valores entraram. */
export function stat(s: StatSummary | undefined): Record<string, number | null> | null {
  if (!s) return null;
  return { media: n1(s.mean), mediana: n1(s.median), n: s.count, min: n1(s.min), max: n1(s.max) };
}
