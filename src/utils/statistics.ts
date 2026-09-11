// ---------------------------------------------------------------------------
// Média e mediana num só lugar.
//
// Taxa de conversão e ciclo de indicação são distribuições torta: um parceiro
// que fechou o primeiro lead em 3 dias e outro que levou 400 puxam a média
// para um número que não descreve ninguém. A mediana descreve o caso típico.
// Por isso todo indicador desses dois grupos carrega os dois valores, e a tela
// escolhe qual mostrar — nunca recalcula por conta própria.
// ---------------------------------------------------------------------------

/** Qual estatística a tela está exibindo. Escolha do usuário, não do cálculo. */
export type StatMode = 'media' | 'mediana';

export const STAT_MODE_LABEL: Record<StatMode, string> = {
  media: 'Média',
  mediana: 'Mediana'
};

/** Sufixo curto para colar no fim de um rótulo ("18 dias em média"). */
export const STAT_MODE_SUFFIX: Record<StatMode, string> = {
  media: 'em média',
  mediana: 'na mediana'
};

export interface StatSummary {
  mean: number | null;
  median: number | null;
  /** Quantos valores entraram na conta — sem isso a mediana não se defende. */
  count: number;
  min: number | null;
  max: number | null;
}

export const EMPTY_STAT_SUMMARY: StatSummary = {
  mean: null,
  median: null,
  count: 0,
  min: null,
  max: null
};

// Descarta o que não é número (undefined de campo não preenchido, NaN de
// divisão por zero): valor inválido não pode virar 0 e rebaixar a média.
function clean(values: Array<number | null | undefined>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

export function mean(values: Array<number | null | undefined>): number | null {
  const list = clean(values);
  if (list.length === 0) return null;
  return list.reduce((acc, v) => acc + v, 0) / list.length;
}

/**
 * Mediana clássica: ordena e pega o valor do meio. Em lista par, a média dos
 * dois centrais — assim a mediana de [1, 3] é 2 e não escolhe arbitrariamente.
 */
export function median(values: Array<number | null | undefined>): number | null {
  const list = clean(values).sort((a, b) => a - b);
  if (list.length === 0) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 === 0 ? (list[mid - 1] + list[mid]) / 2 : list[mid];
}

export function summarize(values: Array<number | null | undefined>): StatSummary {
  const list = clean(values).sort((a, b) => a - b);
  if (list.length === 0) return EMPTY_STAT_SUMMARY;
  const mid = Math.floor(list.length / 2);
  return {
    mean: list.reduce((acc, v) => acc + v, 0) / list.length,
    median: list.length % 2 === 0 ? (list[mid - 1] + list[mid]) / 2 : list[mid],
    count: list.length,
    min: list[0],
    max: list[list.length - 1]
  };
}

/** Lê o resumo conforme o modo escolhido na tela. */
export function pickStat(summary: StatSummary, mode: StatMode): number | null {
  return mode === 'mediana' ? summary.median : summary.mean;
}

/** O mesmo, arredondado para dia inteiro — ciclos são contados em dias. */
export function pickStatRounded(summary: StatSummary, mode: StatMode): number | null {
  const value = pickStat(summary, mode);
  return value === null ? null : Math.round(value);
}
