import type { Referral, Partner, FilterState, ChannelKPIs, PartnerRankingItem, RankingSortKey, PartnerTenureCohortMetric } from '../types';
import { summarize, type StatMode } from './statistics';
import { monthKeyOf } from './dateLabels';

// Format currency into BRL (R$ 1.250,00)
export function formatCurrency(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

// Keep only digits from a CNPJ/CPF string (used for storage & vínculo matching)
export function normalizeDocument(doc: string | undefined | null): string {
  if (!doc) return '';
  return String(doc).replace(/\D/g, '');
}

// Format a CNPJ (14 dígitos) or CPF (11 dígitos) for display. Returns original if not recognizable.
export function formatDocument(doc: string | undefined | null): string {
  const digits = normalizeDocument(doc);
  if (digits.length === 11) {
    // CPF: 000.000.000-00
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return doc ? String(doc).trim() : '—';
}

// Format date into DD/MM/YYYY
export function formatDateBR(dateStr: string | undefined | null): string {
  if (!dateStr || dateStr.trim() === '') return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Helper to calculate difference in calendar days between two YYYY-MM-DD strings
export function calculateDaysBetween(startStr?: string, endStr?: string): number | null {
  if (!startStr || !endStr) return null;
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
}

// Check if a date string falls inside the chosen period filter
export function isDateInPeriod(dateStr: string | undefined, filter: FilterState['period']): boolean {
  if (filter.preset === 'all') return true;
  if (!dateStr) return false; // Date is missing

  const refDate = new Date(dateStr + 'T00:00:00');
  if (isNaN(refDate.getTime())) return false;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter.preset) {
    case 'today':
      return refDate.getTime() === todayStart.getTime();

    case 'last_7_days': {
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return refDate >= sevenDaysAgo && refDate <= now;
    }

    case 'last_30_days': {
      const thirtyDaysAgo = new Date(todayStart);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return refDate >= thirtyDaysAgo && refDate <= now;
    }

    case 'this_month':
    case 'mensal': {
      if (filter.selectedMonth) {
        // format: YYYY-MM
        const [yearStr, monthStr] = filter.selectedMonth.split('-');
        const y = parseInt(yearStr, 10);
        const m = parseInt(monthStr, 10) - 1;
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0, 23, 59, 59);
        return refDate >= firstDay && refDate <= lastDay;
      }
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return refDate >= firstDay && refDate <= lastDay;
    }

    case 'this_quarter':
    case 'trimestral': {
      const targetYear = filter.selectedYear || now.getFullYear();
      const targetQuarter = filter.selectedQuarter !== undefined ? filter.selectedQuarter - 1 : Math.floor(now.getMonth() / 3);
      const startQuarter = new Date(targetYear, targetQuarter * 3, 1);
      const endQuarter = new Date(targetYear, (targetQuarter + 1) * 3, 0, 23, 59, 59);
      return refDate >= startQuarter && refDate <= endQuarter;
    }

    case 'this_year':
    case 'anual': {
      const targetYear = filter.selectedYear || now.getFullYear();
      const startYear = new Date(targetYear, 0, 1);
      const endYear = new Date(targetYear, 11, 31, 23, 59, 59);
      return refDate >= startYear && refDate <= endYear;
    }

    case 'custom': {
      if (filter.startDate) {
        const start = new Date(filter.startDate + 'T00:00:00');
        if (refDate < start) return false;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate + 'T23:59:59');
        if (refDate > end) return false;
      }
      return true;
    }

    default:
      return true;
  }
}

// Filter referrals based on period, partner, safra, deal status, commission status, missing data and search
export function filterReferrals(
  referrals: Referral[],
  filter: FilterState,
  partners?: Partner[]
): Referral[] {
  // A safra do parceiro mora no joinedDate, que não está na indicação: resolve
  // o mês de entrada de cada parceiro uma vez só, antes de varrer a lista.
  const wantsPartnerVintage = !!filter.partnerVintage && filter.partnerVintage !== 'all';
  const partnerVintageById = new Map<string, string>();
  if (wantsPartnerVintage && partners) {
    partners.forEach(p => partnerVintageById.set(p.id, monthKeyOf(p.joinedDate) || 'none'));
  }

  return referrals.filter(ref => {
    // 1. Period filter (evaluated by referralDate; if missing referralDate and not 'all', exclude)
    if (filter.period.preset !== 'all') {
      if (!isDateInPeriod(ref.referralDate, filter.period)) {
        return false;
      }
    }

    // 2. Partner filter
    if (filter.partnerId && filter.partnerId !== 'all') {
      if (ref.partnerId !== filter.partnerId) return false;
    }

    // 3. Deal status filter
    if (filter.dealStatus !== 'all') {
      if (ref.dealStatus !== filter.dealStatus) return false;
    }

    // 4. Commission status filter
    if (filter.commissionStatus !== 'all') {
      if (ref.commissionStatus !== filter.commissionStatus) return false;
    }

    // 4b. Churn filter — só se aplica a indicações 'ganho' (não filtra as demais)
    if (filter.churnFilter && filter.churnFilter !== 'all' && ref.dealStatus === 'ganho') {
      const isChurned = !!ref.churnedAt;
      if (filter.churnFilter === 'active' && isChurned) return false;
      if (filter.churnFilter === 'churned' && !isChurned) return false;
    }

    // 4c. Fechadas no mês: este recorte responde quantos negócios foram ganhos
    // e qual MRR entrou no período. Exige status ganho e data de fechamento no mês.
    if (filter.closeMonth && filter.closeMonth !== 'all') {
      const key = monthKeyOf(ref.closeDate) || 'none';
      if (ref.dealStatus !== 'ganho' || key !== filter.closeMonth) return false;
    }

    // 4d. Safra do PARCEIRO: mês de entrada de quem indicou. Sem a lista de
    // parceiros não dá para resolver a safra, então o filtro não é aplicado —
    // melhor mostrar tudo do que esvaziar a tela sem explicação.
    if (wantsPartnerVintage && partners) {
      const key = (ref.partnerId && partnerVintageById.get(ref.partnerId)) || 'none';
      if (key !== filter.partnerVintage) return false;
    }

    // 4e. Safra da INDICAÇÃO: mês em que ela foi feita. Mesma leitura do
    // relatório de safras de indicações, inclusive a queda para closeDate
    // quando não há referralDate. O corte do dia 15 é do relatório, não da
    // filiação: a indicação pertence ao mês em que aconteceu.
    if (filter.referralVintage && filter.referralVintage !== 'all') {
      const key = monthKeyOf(ref.referralDate || ref.closeDate) || 'none';
      if (key !== filter.referralVintage) return false;
    }

    // 5. Only missing data audit filter
    if (filter.onlyMissingData) {
      if (!ref.hasMissingData) return false;
    }

    // 6. Search query (client name, partner name, company, notes)
    if (filter.searchQuery.trim() !== '') {
      const q = filter.searchQuery.toLowerCase();
      const match = 
        ref.clientName.toLowerCase().includes(q) ||
        ref.partnerName.toLowerCase().includes(q) ||
        (ref.clientCompany && ref.clientCompany.toLowerCase().includes(q)) ||
        (ref.notes && ref.notes.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });
}

// Separa a comissão de uma indicação entre o que já saiu do caixa ('paga') e o
// que ainda é devido ('a_liberar' | 'solicitada' | 'agendada'). 'cancelada' e
// 'pendente_fechamento' não entram em nenhum dos dois: a primeira já não é
// devida, a segunda ainda não existe como obrigação.
function splitCommission(ref: Referral): { paid: number; owed: number; owedCount: number } {
  const installments = ref.commissionInstallments;
  if (installments && installments.length > 0) {
    let paid = 0;
    let owed = 0;
    let owedCount = 0;
    installments.forEach(inst => {
      const value = Number(inst.value) || 0;
      if (inst.status === 'paga') {
        paid += value;
      } else if (inst.status === 'a_liberar' || inst.status === 'solicitada' || inst.status === 'agendada') {
        owed += value;
        owedCount++;
      }
    });
    return { paid, owed, owedCount };
  }

  const value = Number(ref.commissionValue) || 0;
  if (ref.commissionStatus === 'paga') return { paid: value, owed: 0, owedCount: 0 };
  if (ref.commissionStatus === 'a_pagar') return { paid: 0, owed: value, owedCount: 1 };
  return { paid: 0, owed: 0, owedCount: 0 };
}

// Compute comprehensive Channel KPIs
export function calculateKPIs(referrals: Referral[], partners: Partner[]): ChannelKPIs {
  let totalReferrals = referrals.length;
  let totalWonDeals = 0;
  let totalWonVolume = 0;
  let grossWonVolume = 0;
  let totalDiscountVolume = 0;
  let pipelineVolume = 0;
  let commissionsToPay = 0;
  let commissionsPaid = 0;
  let totalCommissionsWon = 0;
  let pendingCommissionCount = 0;
  let incompleteDataCount = 0;
  let churnedCount = 0;
  let churnedVolume = 0;
  // Base viva: é ela que sustenta a rentabilidade do canal hoje. O custo de
  // comissão dela é tudo que já foi pago + o que ainda é devido.
  let activeWonDeals = 0;
  let activeCommissionCost = 0;
  let activeCommissionPaid = 0;
  let activeCommissionOwed = 0;
  // Churn: a comissão já paga virou perda (não volta) e a que restava deixa de
  // ser devida. Nenhuma das duas entra no custo da base viva — ficam à parte.
  let churnedCommissionPaid = 0;
  let churnedCommissionCancelled = 0;

  // Lead to close cycle day calculations
  const leadToCloseDaysList: number[] = [];

  referrals.forEach(ref => {
    if (ref.hasMissingData) incompleteDataCount++;

    const commission = splitCommission(ref);

    if (ref.dealStatus === 'ganho') {
      totalWonDeals++;
      if (ref.dealValue && !isNaN(ref.dealValue)) {
        totalWonVolume += ref.dealValue;
      }
      
      const grossVal = ref.grossDealValue || ref.dealValue || 0;
      grossWonVolume += grossVal;

      if (ref.discountValue && !isNaN(ref.discountValue)) {
        totalDiscountVolume += ref.discountValue;
      } else if (ref.grossDealValue && ref.dealValue && ref.grossDealValue > ref.dealValue) {
        totalDiscountVolume += (ref.grossDealValue - ref.dealValue);
      }

      // Track commissions generated specifically by won deals
      let wonCommission = 0;
      if (ref.commissionValue && !isNaN(ref.commissionValue)) {
        wonCommission = ref.commissionValue;
      } else if (ref.commissionInstallments && ref.commissionInstallments.length > 0) {
        wonCommission = ref.commissionInstallments.reduce((acc, curr) => acc + (curr.value || 0), 0);
      }
      totalCommissionsWon += wonCommission;

      if (ref.churnedAt) {
        churnedCount++;
        if (ref.dealValue && !isNaN(ref.dealValue)) {
          churnedVolume += ref.dealValue;
        }
        churnedCommissionPaid += commission.paid;
        churnedCommissionCancelled += commission.owed;
      } else {
        activeWonDeals++;
        activeCommissionCost += commission.paid + commission.owed;
        activeCommissionPaid += commission.paid;
        activeCommissionOwed += commission.owed;
      }

      // Calculate days between referral and close
      const days = calculateDaysBetween(ref.referralDate, ref.closeDate);
      if (days !== null) {
        leadToCloseDaysList.push(days);
      }
    } else if (['novo', 'contato', 'qualificado', 'negociacao'].includes(ref.dealStatus)) {
      if (ref.dealValue && !isNaN(ref.dealValue)) {
        pipelineVolume += ref.dealValue;
      }
    }

    // Commission aggregations (installment-aware if present)
    commissionsPaid += commission.paid;
    commissionsToPay += commission.owed;
    pendingCommissionCount += commission.owedCount;
  });

  const conversionRate = totalReferrals > 0 ? (totalWonDeals / totalReferrals) * 100 : 0;
  const avgDiscountPercent = grossWonVolume > 0 ? (totalDiscountVolume / grossWonVolume) * 100 : 0;

  // Churn: totalWonVolume/totalWonDeals continuam históricos; activeWonVolume
  // é o que efetivamente ainda gera MRR hoje.
  const activeWonVolume = totalWonVolume - churnedVolume;
  const churnRate = totalWonDeals > 0 ? (churnedCount / totalWonDeals) * 100 : 0;

  // Performance Consolidada: receita é MRR (mensal, recorrente), comissão é um
  // custo único de aquisição (a soma das parcelas). Comparar os dois direto é
  // comparar mês contra vitalício — por isso a receita é anualizada em 12 meses
  // antes de virar margem/ROI, e o payback aparece em meses (sem premissa).
  // Base = contratos vivos: churn tira a receita, a comissão que restava deixa
  // de ser devida e a que já foi paga vira perda declarada à parte.
  const avgTicket = activeWonDeals > 0 ? activeWonVolume / activeWonDeals : 0;
  const avgCommissionCost = activeWonDeals > 0 ? activeCommissionCost / activeWonDeals : 0;
  const paybackMonths = avgTicket > 0 && avgCommissionCost > 0 ? avgCommissionCost / avgTicket : null;
  const revenue12mPerDeal = avgTicket * 12;
  const netChannelMargin = revenue12mPerDeal - avgCommissionCost;
  const commissionSharePercent = revenue12mPerDeal > 0 ? (avgCommissionCost / revenue12mPerDeal) * 100 : 0;
  const revenueMultiplier = avgCommissionCost > 0 ? revenue12mPerDeal / avgCommissionCost : 0;
  const netVolume12m = activeWonVolume * 12 - activeCommissionCost;

  // Ciclo indicação -> fechamento: guarda a distribuição inteira, não só a
  // média. A média sozinha esconde o caso típico quando um punhado de negócios
  // arrasta meses a mais que o resto.
  const daysReferralToClose = summarize(leadToCloseDaysList);
  const avgDaysReferralToClose =
    daysReferralToClose.mean !== null ? Math.round(daysReferralToClose.mean) : null;

  // Calculate cycle from partner join to first referral
  const partnerMap = new Map<string, Partner>();
  partners.forEach(p => partnerMap.set(p.id, p));

  const partnerFirstReferralDaysList: number[] = [];
  const partnersWithReferrals = new Set<string>();

  // Find the earliest referral date for each partner
  const partnerEarliestRefDate = new Map<string, string>();
  referrals.forEach(ref => {
    if (ref.partnerId) {
      partnersWithReferrals.add(ref.partnerId);
      if (ref.referralDate) {
        const currentEarliest = partnerEarliestRefDate.get(ref.partnerId);
        if (!currentEarliest || ref.referralDate < currentEarliest) {
          partnerEarliestRefDate.set(ref.partnerId, ref.referralDate);
        }
      }
    }
  });

  partnerEarliestRefDate.forEach((earliestRefDate, partnerId) => {
    const partner = partnerMap.get(partnerId);
    if (partner && partner.joinedDate) {
      const days = calculateDaysBetween(partner.joinedDate, earliestRefDate);
      if (days !== null) {
        partnerFirstReferralDaysList.push(days);
      }
    }
  });

  const daysPartnerToFirstReferral = summarize(partnerFirstReferralDaysList);
  const avgDaysPartnerToFirstReferral =
    daysPartnerToFirstReferral.mean !== null ? Math.round(daysPartnerToFirstReferral.mean) : null;

  // Distribuição da conversão parceiro a parceiro. conversionRate lá em cima é
  // a taxa agregada do canal e é dominada por quem mais indica: um parceiro com
  // 80 indicações decide o número sozinho. Aqui cada parceiro pesa igual, então
  // a mediana responde "qual a conversão do parceiro típico". Só entram os que
  // indicaram — quem não indicou não tem taxa 0%, não tem taxa nenhuma.
  const conversionRatesByPartner: number[] = [];
  const wonByPartner = new Map<string, number>();
  const totalByPartner = new Map<string, number>();
  referrals.forEach(ref => {
    if (!ref.partnerId) return;
    totalByPartner.set(ref.partnerId, (totalByPartner.get(ref.partnerId) || 0) + 1);
    if (ref.dealStatus === 'ganho') {
      wonByPartner.set(ref.partnerId, (wonByPartner.get(ref.partnerId) || 0) + 1);
    }
  });
  totalByPartner.forEach((total, partnerId) => {
    if (total <= 0) return;
    conversionRatesByPartner.push(((wonByPartner.get(partnerId) || 0) / total) * 100);
  });
  const conversionByPartner = summarize(conversionRatesByPartner);

  // Em risco continua sendo base ativa: o parceiro segue apto a indicar — é
  // justamente por isso que o status é "risco" e não "inativo". Só onboarding
  // (ainda não engatou) e inativo ficam fora da conta.
  const activePartnersCount = partners.filter(
    p => p.status === 'ativo' || p.status === 'risco'
  ).length;
  const partnerActivationRate = partners.length > 0
    ? (partnersWithReferrals.size / partners.length) * 100
    : 0;

  return {
    totalReferrals,
    totalWonDeals,
    conversionRate,
    totalWonVolume,
    grossWonVolume,
    totalDiscountVolume,
    avgDiscountPercent,
    pipelineVolume,
    commissionsToPay,
    commissionsPaid,
    totalCommissionsWon,
    avgTicket,
    avgCommissionCost,
    paybackMonths,
    revenue12mPerDeal,
    netChannelMargin,
    commissionSharePercent,
    revenueMultiplier,
    netVolume12m,
    activeWonDeals,
    activeCommissionCost,
    activeCommissionPaid,
    activeCommissionOwed,
    churnedCommissionPaid,
    churnedCommissionCancelled,
    pendingCommissionCount,
    avgDaysPartnerToFirstReferral,
    avgDaysReferralToClose,
    daysPartnerToFirstReferral,
    daysReferralToClose,
    conversionByPartner,
    activePartnersCount,
    partnerActivationRate,
    incompleteDataCount,
    churnedCount,
    churnedVolume,
    activeWonVolume,
    churnRate
  };
}

// Calculate Partner Rankings for strategic review with flexible sorting
export function calculatePartnerRankings(
  referrals: Referral[], 
  partners: Partner[], 
  sortKey: RankingSortKey = 'wonDeals'
): PartnerRankingItem[] {
  const rankingMap = new Map<string, PartnerRankingItem>();

  // Initialize with all registered partners
  partners.forEach(p => {
    rankingMap.set(p.id, {
      partnerId: p.id,
      idConexa: p.idConexa,
      document: p.document,
      partnerName: p.name,
      profile: p.profile,
      responsiblePerson: p.responsiblePerson,
      status: p.status,
      joinedDate: p.joinedDate,
      totalReferrals: 0,
      wonReferrals: 0,
      wonVolume: 0,
      totalCommissions: 0,
      conversionRate: 0,
      daysToFirstReferral: null
    });
  });

  // Track earliest referral date for each partner
  const earliestDates = new Map<string, string>();

  referrals.forEach(ref => {
    let item = rankingMap.get(ref.partnerId);
    if (!item) {
      item = {
        partnerId: ref.partnerId,
        partnerName: ref.partnerName || 'Parceiro Desconhecido',
        joinedDate: undefined,
        totalReferrals: 0,
        wonReferrals: 0,
        wonVolume: 0,
        totalCommissions: 0,
        conversionRate: 0,
        daysToFirstReferral: null
      };
      rankingMap.set(ref.partnerId, item);
    }

    item.totalReferrals++;
    if (ref.referralDate) {
      const current = earliestDates.get(ref.partnerId);
      if (!current || ref.referralDate < current) {
        earliestDates.set(ref.partnerId, ref.referralDate);
      }
    }

    if (ref.dealStatus === 'ganho') {
      item.wonReferrals++;
      if (ref.dealValue) item.wonVolume += ref.dealValue;
      if (ref.commissionValue) item.totalCommissions += ref.commissionValue;
    }
  });

  // Compute conversion rates and activation time
  rankingMap.forEach(item => {
    item.conversionRate = item.totalReferrals > 0 ? (item.wonReferrals / item.totalReferrals) * 100 : 0;
    const earliest = earliestDates.get(item.partnerId);
    if (item.joinedDate && earliest) {
      item.daysToFirstReferral = calculateDaysBetween(item.joinedDate, earliest);
    }
  });

  const list = Array.from(rankingMap.values());

  return list.sort((a, b) => {
    switch (sortKey) {
      case 'wonDeals':
        if (b.wonReferrals !== a.wonReferrals) return b.wonReferrals - a.wonReferrals;
        if (b.wonVolume !== a.wonVolume) return b.wonVolume - a.wonVolume;
        return b.totalReferrals - a.totalReferrals;

      case 'referrals':
        if (b.totalReferrals !== a.totalReferrals) return b.totalReferrals - a.totalReferrals;
        return b.wonReferrals - a.wonReferrals;

      case 'volume':
        if (b.wonVolume !== a.wonVolume) return b.wonVolume - a.wonVolume;
        return b.wonReferrals - a.wonReferrals;

      case 'conversion':
        if (b.conversionRate !== a.conversionRate) return b.conversionRate - a.conversionRate;
        return b.wonReferrals - a.wonReferrals;

      case 'speed':
        // Menor tempo primeiro, itens sem ativação ao final
        if (a.daysToFirstReferral !== null && b.daysToFirstReferral !== null) {
          return a.daysToFirstReferral - b.daysToFirstReferral;
        }
        if (a.daysToFirstReferral !== null) return -1;
        if (b.daysToFirstReferral !== null) return 1;
        return b.totalReferrals - a.totalReferrals;

      default:
        return b.wonReferrals - a.wonReferrals;
    }
  });
}

// Helper to convert date string (YYYY-MM-DD or ISO) into absolute month index (year * 12 + month0)
function parseMonthIndex(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length < 2) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return null;
  return y * 12 + (m - 1);
}

/**
 * Calculates cohort maturation metrics by relative partner tenure (Mês 1, Mês 2, Mês 3...)
 * When filtered by partner: returns the partner's referrals, closed deals, and conversion rate per month.
 * When without filter: returns the channel average per partner across all partners for each month of tenure,
 * plus total sums and active cohort size.
 */
export function calculatePartnerTenureCohortMetrics(
  referrals: Referral[],
  partners: Partner[],
  options?: {
    selectedPartnerId?: string;
    viewMode?: 'average' | 'total';
    limitMonths?: number;
    /** Qual estatística resolve referrals/closedDeals/conversionRate. Padrão: média. */
    statMode?: StatMode;
  }
): {
  metrics: PartnerTenureCohortMetric[];
  partnerName?: string;
  isFiltered: boolean;
  activePartnersCount: number;
} {
  const isFiltered = Boolean(options?.selectedPartnerId && options?.selectedPartnerId !== 'all');
  const targetPartner = isFiltered ? partners.find(p => p.id === options?.selectedPartnerId) : null;
  const partnerName = targetPartner ? targetPartner.name : 'Média de Todos os Parceiros';

  // Map partner ID to baseline join month index
  const partnerJoinMonthMap = new Map<string, number>();
  const partnerTenureMap = new Map<string, number>();

  const now = new Date();
  const currentMonthIdx = now.getFullYear() * 12 + now.getMonth();

  partners.forEach(p => {
    let joinIdx = parseMonthIndex(p.joinedDate);
    if (joinIdx === null) {
      // Fallback: earliest referral date from this partner
      const pRefs = referrals.filter(r => r.partnerId === p.id && (r.referralDate || r.closeDate));
      const refMonthIdxs = pRefs
        .map(r => parseMonthIndex(r.referralDate || r.closeDate))
        .filter((idx): idx is number => idx !== null);
      if (refMonthIdxs.length > 0) {
        joinIdx = Math.min(...refMonthIdxs);
      }
    }

    if (joinIdx !== null) {
      partnerJoinMonthMap.set(p.id, joinIdx);
      const tenure = Math.max(1, currentMonthIdx - joinIdx + 1);
      partnerTenureMap.set(p.id, tenure);
    }
  });

  // Target referrals
  const filteredReferrals = isFiltered 
    ? referrals.filter(r => r.partnerId === options?.selectedPartnerId)
    : referrals;

  // Track max relative month
  let highestMonth = 1;
  interface MonthBucket {
    referrals: number;
    won: number;
  }

  // If filtered, track buckets specifically for that partner
  // If not filtered, track partner-level buckets and overall totals
  const partnerMonthMap = new Map<string, Map<number, MonthBucket>>();
  const globalMonthMap = new Map<number, MonthBucket>();

  filteredReferrals.forEach(ref => {
    const pId = ref.partnerId;
    let baseJoinIdx = partnerJoinMonthMap.get(pId);
    
    // If partner not in partners list or had no join date, try referral date
    const refMonthIdx = parseMonthIndex(ref.referralDate || ref.closeDate);
    if (baseJoinIdx === undefined && refMonthIdx !== null) {
      baseJoinIdx = refMonthIdx;
      partnerJoinMonthMap.set(pId, baseJoinIdx);
      partnerTenureMap.set(pId, Math.max(1, currentMonthIdx - baseJoinIdx + 1));
    }

    let relMonth = 1;
    if (baseJoinIdx !== undefined && refMonthIdx !== null) {
      relMonth = refMonthIdx - baseJoinIdx + 1;
      if (relMonth < 1) relMonth = 1;
    }

    if (relMonth > highestMonth) {
      highestMonth = relMonth;
    }

    const isWon = ref.dealStatus === 'ganho';

    // Update global map
    const currGlobal = globalMonthMap.get(relMonth) || { referrals: 0, won: 0 };
    currGlobal.referrals += 1;
    if (isWon) currGlobal.won += 1;
    globalMonthMap.set(relMonth, currGlobal);

    // Update partner-specific map
    if (!partnerMonthMap.has(pId)) {
      partnerMonthMap.set(pId, new Map<number, MonthBucket>());
    }
    const pMap = partnerMonthMap.get(pId)!;
    const currP = pMap.get(relMonth) || { referrals: 0, won: 0 };
    currP.referrals += 1;
    if (isWon) currP.won += 1;
    pMap.set(relMonth, currP);
  });

  // Calculate highest tenure among partners
  const maxTenure = Math.max(...Array.from(partnerTenureMap.values()), 1);
  const calculatedMax = Math.max(highestMonth, isFiltered ? (partnerTenureMap.get(options?.selectedPartnerId || '') || 3) : Math.min(maxTenure, 8));
  
  // Decide how many months to display: at least 6 months if unfiltered (or up to 12), at least 4 if single partner
  const defaultMin = isFiltered ? 4 : 6;
  let totalMonthsToShow = Math.max(calculatedMax, defaultMin);
  if (options?.limitMonths) {
    totalMonthsToShow = Math.min(totalMonthsToShow, options.limitMonths);
  }

  const metrics: PartnerTenureCohortMetric[] = [];
  const statMode: StatMode = options?.statMode === 'mediana' ? 'mediana' : 'media';
  const round1 = (v: number | null): number | null => (v === null ? null : Number(v.toFixed(1)));

  for (let m = 1; m <= totalMonthsToShow; m++) {
    if (isFiltered && options?.selectedPartnerId) {
      const pMap = partnerMonthMap.get(options.selectedPartnerId);
      const b = pMap?.get(m) || { referrals: 0, won: 0 };
      const conv = b.referrals > 0 ? (b.won / b.referrals) * 100 : 0;

      // Um parceiro só: média e mediana são o próprio número dele. Repetir os
      // três campos é de propósito — a tela alterna sem precisar saber disso.
      metrics.push({
        monthIndex: m,
        monthLabel: `Mês ${m}`,
        referrals: b.referrals,
        closedDeals: b.won,
        conversionRate: Number(conv.toFixed(1)),
        totalReferralsRaw: b.referrals,
        totalClosedRaw: b.won,
        activePartnersInTenure: 1,
        conversionRateAggregate: Number(conv.toFixed(1)),
        conversionRateMean: b.referrals > 0 ? Number(conv.toFixed(1)) : null,
        conversionRateMedian: b.referrals > 0 ? Number(conv.toFixed(1)) : null,
        partnersWithReferralsInMonth: b.referrals > 0 ? 1 : 0,
        referralsPerPartnerMean: b.referrals,
        referralsPerPartnerMedian: b.referrals,
        closedPerPartnerMean: b.won,
        closedPerPartnerMedian: b.won
      });
    } else {
      // Sem filtro: consolida entre os parceiros que já viveram o mês m.
      const partnersEligible = partners.filter(p => (partnerTenureMap.get(p.id) || 1) >= m);
      const gBucket = globalMonthMap.get(m) || { referrals: 0, won: 0 };
      const conv = gBucket.referrals > 0 ? (gBucket.won / gBucket.referrals) * 100 : 0;

      // Produção por parceiro elegível — quem não indicou entra como zero, que
      // é informação (a safra não engajou), não ausência de dado.
      const perPartnerReferrals: number[] = [];
      const perPartnerWon: number[] = [];
      const perPartnerConversion: number[] = [];
      partnersEligible.forEach(p => {
        const b = partnerMonthMap.get(p.id)?.get(m) || { referrals: 0, won: 0 };
        perPartnerReferrals.push(b.referrals);
        perPartnerWon.push(b.won);
        // Conversão só existe para quem indicou: sem indicação não há taxa 0%,
        // há ausência de taxa — incluir zeros afundaria a mediana de graça.
        if (b.referrals > 0) perPartnerConversion.push((b.won / b.referrals) * 100);
      });

      const refSummary = summarize(perPartnerReferrals);
      const wonSummary = summarize(perPartnerWon);
      const convSummary = summarize(perPartnerConversion);

      const isTotalMode = options?.viewMode === 'total';
      const perPartnerRef = statMode === 'mediana' ? refSummary.median : refSummary.mean;
      const perPartnerWonVal = statMode === 'mediana' ? wonSummary.median : wonSummary.mean;
      // Na média, a taxa exibida continua sendo a agregada do canal (o número
      // histórico do card). Na mediana, passa a ser a do parceiro típico.
      const displayConv = statMode === 'mediana' ? convSummary.median : conv;

      metrics.push({
        monthIndex: m,
        monthLabel: `Mês ${m}`,
        referrals: isTotalMode ? gBucket.referrals : Number((perPartnerRef ?? 0).toFixed(1)),
        closedDeals: isTotalMode ? gBucket.won : Number((perPartnerWonVal ?? 0).toFixed(1)),
        conversionRate: Number((displayConv ?? 0).toFixed(1)),
        totalReferralsRaw: gBucket.referrals,
        totalClosedRaw: gBucket.won,
        activePartnersInTenure: partnersEligible.length,
        conversionRateAggregate: Number(conv.toFixed(1)),
        conversionRateMean: round1(convSummary.mean),
        conversionRateMedian: round1(convSummary.median),
        partnersWithReferralsInMonth: convSummary.count,
        referralsPerPartnerMean: Number((refSummary.mean ?? 0).toFixed(1)),
        referralsPerPartnerMedian: Number((refSummary.median ?? 0).toFixed(1)),
        closedPerPartnerMean: Number((wonSummary.mean ?? 0).toFixed(1)),
        closedPerPartnerMedian: Number((wonSummary.median ?? 0).toFixed(1))
      });
    }
  }

  return {
    metrics,
    partnerName,
    isFiltered,
    activePartnersCount: isFiltered ? 1 : partners.length
  };
}
