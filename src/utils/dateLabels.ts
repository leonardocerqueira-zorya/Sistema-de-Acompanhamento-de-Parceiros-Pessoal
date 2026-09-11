// Rótulos de mês em PT-BR, compartilhados entre relatórios agrupados por mês
// (safras em vintageAnalytics.ts, cancelamentos em churnAnalytics.ts).
export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MONTH_SHORT_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Chave de safra ("2026-05") a partir de uma data ISO. null quando a data está
 * vazia ou ilegível — quem chama decide se isso vira "sem safra" ou descarte.
 */
export function monthKeyOf(date?: string | null): string | null {
  const clean = (date || '').trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** "2026-05" -> "Maio/2026". Devolve a própria chave se não der para ler. */
export function monthLabelPt(key: string): string {
  const parts = key.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return key;
  return `${MONTH_NAMES_PT[m - 1]}/${y}`;
}
