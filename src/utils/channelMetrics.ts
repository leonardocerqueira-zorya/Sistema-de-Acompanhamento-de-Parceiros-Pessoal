import type { ChannelCostEntry, NewMrrEntry, Referral } from '../types';

// Tolerância para considerar o MRR do canal "batendo" com as indicações
// fechadas — acima disso soma arredondamento de centavos, é divergência real.
const DISCREPANCY_TOLERANCE_REAIS = 1;

// Novo MRR de um negócio fechado: usa o MRR líquido negociado quando existe;
// para plano mensal, dealValue já É o MRR, então serve de fallback direto.
function referralMrr(r: Referral): number {
  if (r.mrrNet !== undefined && r.mrrNet !== null && !isNaN(r.mrrNet)) return r.mrrNet;
  if (r.planRecurrence === 'mensal' && r.dealValue) return r.dealValue;
  return 0;
}

// MRR de tabela (cheio, antes do desconto) do mesmo negócio. Sem bruto
// informado, assume que não houve desconto e devolve o próprio líquido.
function referralGrossMrr(r: Referral): number {
  if (r.mrrGross !== undefined && r.mrrGross !== null && !isNaN(r.mrrGross)) return r.mrrGross;
  return referralMrr(r);
}

// Indicações "ganho" cujo fechamento (closeDate) caiu no mês informado (YYYY-MM).
// Fechar num mês é um fato histórico: não muda se o cliente cancelar depois.
export function referralsClosedInPeriod(referrals: Referral[], period: string): Referral[] {
  return referrals.filter(r => r.dealStatus === 'ganho' && (r.closeDate || '').slice(0, 7) === period);
}

// Indicação "ganho" que ainda gera MRR na data de referência (hoje, por
// padrão) — ou seja, ainda não foi marcada como cancelada até essa data.
export function isActiveWon(r: Referral, asOfDate: string = new Date().toISOString().slice(0, 10)): boolean {
  if (r.dealStatus !== 'ganho') return false;
  if (!r.churnedAt) return true;
  return r.churnedAt > asOfDate;
}

// MRR "ativo hoje": soma o MRR de todo "ganho" que ainda não cancelou até a
// data de referência. Diferente de referralsClosedInPeriod, que é histórico.
export function currentActiveMrr(referrals: Referral[], asOfDate: string = new Date().toISOString().slice(0, 10)): number {
  return referrals.filter(r => isActiveWon(r, asOfDate)).reduce((sum, r) => sum + referralMrr(r), 0);
}

// Soma do novo MRR gerado pelo canal de parceiros no mês, a partir das
// indicações realmente fechadas no sistema (não do valor informado à mão).
export function partnersChannelMrrFromReferrals(referrals: Referral[], period: string): number {
  return referralsClosedInPeriod(referrals, period).reduce((sum, r) => sum + referralMrr(r), 0);
}

// O mesmo MRR do mês, mas a preço de tabela. Serve só para explicar a
// diferença: o financeiro costuma informar o cheio, o canal conta o líquido.
export function partnersChannelGrossMrrFromReferrals(referrals: Referral[], period: string): number {
  return referralsClosedInPeriod(referrals, period).reduce((sum, r) => sum + referralGrossMrr(r), 0);
}

// MRR do Canal de Parceiros IMPLÍCITO no que foi informado: total da empresa
// menos a soma dos outros canais. Nunca é digitado diretamente.
export function partnersChannelMrrDeclared(entry: NewMrrEntry | undefined): number | null {
  if (!entry) return null;
  const others = entry.otherChannels.reduce((sum, c) => sum + (c.value || 0), 0);
  return entry.totalNewMrr - others;
}

export interface MrrDiscrepancyCheck {
  hasEntry: boolean;
  declared: number | null; // MRR do canal implícito no total informado
  fromReferrals: number; // MRR do canal calculado pelas indicações fechadas (líquido)
  grossFromReferrals: number; // o mesmo mês a preço de tabela (antes do desconto)
  discountTotal: number; // desconto concedido no mês = bruto - líquido
  diff: number | null; // declared - fromReferrals
  diffPercent: number | null; // diff em % de fromReferrals (null se fromReferrals=0 e diff=0)
  hasDiscrepancy: boolean;
  // Diferença que é exatamente o desconto: o informado bate com o bruto, não
  // com o líquido. É explicação, não erro de preenchimento.
  explainedByDiscount: boolean;
}

// Confronta o MRR do canal "informado" (total - outros canais) com o MRR
// calculado a partir das indicações realmente fechadas no período.
export function checkMrrDiscrepancy(entry: NewMrrEntry | undefined, referrals: Referral[], period: string): MrrDiscrepancyCheck {
  const fromReferrals = partnersChannelMrrFromReferrals(referrals, period);
  const grossFromReferrals = partnersChannelGrossMrrFromReferrals(referrals, period);
  const discountTotal = grossFromReferrals - fromReferrals;
  const declared = partnersChannelMrrDeclared(entry);

  if (declared === null) {
    return {
      hasEntry: false,
      declared: null,
      fromReferrals,
      grossFromReferrals,
      discountTotal,
      diff: null,
      diffPercent: null,
      hasDiscrepancy: false,
      explainedByDiscount: false
    };
  }

  const diff = declared - fromReferrals;
  const diffPercent = fromReferrals !== 0 ? (diff / fromReferrals) * 100 : (diff !== 0 ? 100 : 0);
  const hasDiscrepancy = Math.abs(diff) > DISCREPANCY_TOLERANCE_REAIS;
  const explainedByDiscount =
    hasDiscrepancy &&
    discountTotal > DISCREPANCY_TOLERANCE_REAIS &&
    Math.abs(declared - grossFromReferrals) <= DISCREPANCY_TOLERANCE_REAIS;

  return {
    hasEntry: true,
    declared,
    fromReferrals,
    grossFromReferrals,
    discountTotal,
    diff,
    diffPercent,
    hasDiscrepancy,
    explainedByDiscount
  };
}

export interface ChannelPeriodMetrics {
  period: string;
  cost: number | null; // custo do canal informado pelo financeiro nesse mês
  closedDealsCount: number; // negócios "ganho" fechados no canal nesse mês
  activePartnersCount: number; // parceiros distintos com >=1 fechamento nesse mês
  channelMrrFromReferrals: number; // novo MRR do canal, calculado pelas indicações
  // CAC — duas leituras, lado a lado (pedido explícito: mostrar as duas com explicação).
  cacPorCliente: number | null; // custo do canal ÷ negócios fechados
  cacPorMrr: number | null; // custo do canal ÷ novo MRR do canal (R$ de custo por R$1 de MRR novo)
  // CAP — Custo de Aquisição por Parceiro.
  cap: number | null; // custo do canal ÷ parceiros ativos (com fechamento) no mês
  // Relevância do canal no novo MRR da empresa (quando há entrada de MRR nesse mês).
  companyTotalNewMrr: number | null;
  channelRelevancePercent: number | null; // channelMrrFromReferrals ÷ companyTotalNewMrr * 100
  // Ticket Médio — canal vs empresa toda. totalNewDealsCount é preenchido à mão
  // (nº de vendas fechadas na empresa, todos os canais) porque o sistema só
  // enxerga as indicações do canal de parceiros.
  totalNewDealsCount: number | null;
  ticketMedioCanal: number | null; // MRR do canal ÷ negócios fechados no canal
  ticketMedioTotal: number | null; // Novo MRR total da empresa ÷ total de vendas informado
  ticketMedioComparisonPercent: number | null; // quanto o ticket do canal está acima/abaixo do da empresa
  discrepancy: MrrDiscrepancyCheck;
}

// Ponto único de cálculo: junta custo do canal, indicações fechadas e novo MRR
// informado num único conjunto de métricas para um mês (YYYY-MM).
export function calculateChannelPeriodMetrics(
  period: string,
  referrals: Referral[],
  costEntries: ChannelCostEntry[],
  mrrEntries: NewMrrEntry[]
): ChannelPeriodMetrics {
  const costEntry = costEntries.find(e => e.period === period);
  const mrrEntry = mrrEntries.find(e => e.period === period);

  const closedRefs = referralsClosedInPeriod(referrals, period);
  const closedDealsCount = closedRefs.length;
  const activePartnersCount = new Set(closedRefs.map(r => r.partnerId)).size;
  const channelMrrFromReferrals = partnersChannelMrrFromReferrals(referrals, period);

  const cost = costEntry ? costEntry.totalCost : null;

  const cacPorCliente = cost !== null && closedDealsCount > 0 ? cost / closedDealsCount : null;
  const cacPorMrr = cost !== null && channelMrrFromReferrals > 0 ? cost / channelMrrFromReferrals : null;
  const cap = cost !== null && activePartnersCount > 0 ? cost / activePartnersCount : null;

  const companyTotalNewMrr = mrrEntry ? mrrEntry.totalNewMrr : null;
  const channelRelevancePercent =
    companyTotalNewMrr !== null && companyTotalNewMrr > 0 ? (channelMrrFromReferrals / companyTotalNewMrr) * 100 : null;

  const totalNewDealsCount = mrrEntry?.totalNewDealsCount ?? null;
  const ticketMedioCanal = closedDealsCount > 0 ? channelMrrFromReferrals / closedDealsCount : null;
  const ticketMedioTotal =
    companyTotalNewMrr !== null && totalNewDealsCount !== null && totalNewDealsCount > 0
      ? companyTotalNewMrr / totalNewDealsCount
      : null;
  const ticketMedioComparisonPercent =
    ticketMedioCanal !== null && ticketMedioTotal !== null && ticketMedioTotal > 0
      ? ((ticketMedioCanal - ticketMedioTotal) / ticketMedioTotal) * 100
      : null;

  const discrepancy = checkMrrDiscrepancy(mrrEntry, referrals, period);

  return {
    period,
    cost,
    closedDealsCount,
    activePartnersCount,
    channelMrrFromReferrals,
    cacPorCliente,
    cacPorMrr,
    cap,
    companyTotalNewMrr,
    totalNewDealsCount,
    ticketMedioCanal,
    ticketMedioTotal,
    ticketMedioComparisonPercent,
    channelRelevancePercent,
    discrepancy
  };
}
