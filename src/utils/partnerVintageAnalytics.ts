import type {
  Partner,
  PartnerVintage,
  PartnerVintageMember,
  PartnerVintageReport,
  Referral
} from '../types';
import { calculatePartnerEngagement } from './partnerEngagement';
import { summarize, EMPTY_STAT_SUMMARY } from './statistics';
import { MONTH_NAMES_PT, MONTH_SHORT_PT } from './dateLabels';
import { calculateDaysBetween } from './analytics';

// ---------------------------------------------------------------------------
// Safra de parceiro: agrupa parceiros pelo MÊS DE ENTRADA no programa.
//
// Safra de março de 2026 = todo mundo cuja joinedDate cai entre 01/03 e 31/03.
// Não existe corte nem fechamento: a safra não "encerra", ela só envelhece.
// Diferente de vintageAnalytics.ts, que agrupa INDICAÇÕES e tem corte no dia 15
// do mês seguinte.
//
// A armadilha da comparação: a safra de janeiro teve oito meses para indicar e
// a de agosto teve duas semanas. Comparar o total das duas diz só quem é mais
// velha. Por isso existe a janela (windowDays): com ela, cada parceiro conta
// apenas o que produziu nos seus N primeiros dias de programa, e as safras
// ficam comparáveis. Safra jovem demais para completar a janela sai marcada
// com isWindowIncomplete — o número dela ainda vai crescer.
// ---------------------------------------------------------------------------

/** Data que posiciona a indicação na linha do tempo do parceiro. */
function referralDateOf(r: Referral): string | null {
  return r.referralDate || r.closeDate || null;
}

function addDays(iso: string, days: number): string {
  const ms = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

/** MRR do negócio. Mesma leitura do relatório de safras de indicação. */
function dealMrr(r: Referral): number {
  const val = Number(r.dealValue);
  return Number.isFinite(val) ? val : 0;
}

export function calculatePartnerVintages(
  partners: Partner[],
  referrals: Referral[],
  options?: {
    /** null = vida inteira do parceiro. 30/60/90/180 = primeiros N dias de programa. */
    windowDays?: number | null;
    today?: Date;
  }
): PartnerVintageReport {
  const windowDays = options?.windowDays ?? null;
  const today = options?.today ?? new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentMonthIdx = today.getFullYear() * 12 + today.getMonth();

  // Indicações por parceiro, resolvidas uma vez só.
  const referralsByPartner = new Map<string, Referral[]>();
  referrals.forEach(r => {
    if (!r.partnerId) return;
    const list = referralsByPartner.get(r.partnerId);
    if (list) list.push(r);
    else referralsByPartner.set(r.partnerId, [r]);
  });

  // Agrupa parceiros por mês de entrada. Sem joinedDate não há safra: o
  // parceiro fica de fora e é contado à parte, para a tela cobrar o cadastro.
  const byVintage = new Map<string, Partner[]>();
  let partnersWithoutJoinedDate = 0;

  partners.forEach(p => {
    const joined = (p.joinedDate || '').trim().slice(0, 10);
    const parts = joined.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (parts.length < 2 || isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      partnersWithoutJoinedDate++;
      return;
    }
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const list = byVintage.get(key);
    if (list) list.push(p);
    else byVintage.set(key, [p]);
  });

  const vintages: PartnerVintage[] = Array.from(byVintage.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([vintageId, vintagePartners]) => {
      const [yearStr, monthStr] = vintageId.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const lastDay = new Date(year, month, 0).getDate();

      const monthsSinceEntry = Math.max(1, currentMonthIdx - (year * 12 + (month - 1)) + 1);

      const members: PartnerVintageMember[] = [];
      let totalReferrals = 0;
      let wonDeals = 0;
      let wonVolume = 0;
      let activeWonVolume = 0;
      let churnedVolume = 0;
      let windowIncompleteCount = 0;

      const referralsPerPartnerList: number[] = [];
      const daysToFirstList: number[] = [];
      const conversionList: number[] = [];
      const engagementList: number[] = [];

      vintagePartners.forEach(p => {
        const joined = (p.joinedDate || '').slice(0, 10);
        // Fim da janela de avaliação deste parceiro. Sem janela, vale tudo.
        const windowEnd = windowDays === null ? null : addDays(joined, windowDays);
        if (windowEnd !== null && windowEnd > todayStr) windowIncompleteCount++;

        const all = referralsByPartner.get(p.id) || [];
        // Indicação anterior à entrada não é descartada: ela existe e foi feita
        // por esse parceiro. O que a janela corta é só o que veio depois do prazo.
        const inWindow = windowEnd === null
          ? all
          : all.filter(r => {
              const d = referralDateOf(r);
              return d === null ? false : d.slice(0, 10) <= windowEnd;
            });

        let memberWon = 0;
        let memberWonVolume = 0;
        let memberActiveVolume = 0;
        let earliest: string | null = null;

        inWindow.forEach(r => {
          const d = referralDateOf(r);
          if (d) {
            const day = d.slice(0, 10);
            if (earliest === null || day < earliest) earliest = day;
          }
          if (r.dealStatus !== 'ganho') return;
          memberWon++;
          const mrr = dealMrr(r);
          memberWonVolume += mrr;
          if (r.churnedAt) churnedVolume += mrr;
          else memberActiveVolume += mrr;
        });

        const memberReferrals = inWindow.length;
        const daysToFirst = earliest && joined ? calculateDaysBetween(joined, earliest) : null;
        const conversionRate = memberReferrals > 0 ? (memberWon / memberReferrals) * 100 : null;

        // Engajamento usa SEMPRE a base inteira de indicações do parceiro: é o
        // estado de hoje, não um recorte histórico. A janela vale só para
        // produção — ver o comentário do cabeçalho.
        const engagement = calculatePartnerEngagement(p, all, today);

        totalReferrals += memberReferrals;
        wonDeals += memberWon;
        wonVolume += memberWonVolume;
        activeWonVolume += memberActiveVolume;

        referralsPerPartnerList.push(memberReferrals);
        if (daysToFirst !== null) daysToFirstList.push(daysToFirst);
        if (conversionRate !== null) conversionList.push(conversionRate);
        if (engagement.score !== null) engagementList.push(engagement.score);

        members.push({
          partnerId: p.id,
          partnerName: p.name,
          joinedDate: joined,
          status: p.status,
          accountOwner: p.accountOwner,
          profile: p.profile,
          referrals: memberReferrals,
          wonDeals: memberWon,
          conversionRate,
          wonVolume: memberWonVolume,
          activeWonVolume: memberActiveVolume,
          daysToFirstReferral: daysToFirst,
          engagementScore: engagement.score,
          engagementLevel: engagement.level
        });
      });

      members.sort(
        (a, b) => b.referrals - a.referrals || a.partnerName.localeCompare(b.partnerName, 'pt-BR')
      );

      const partnerCount = vintagePartners.length;
      const partnersWithReferral = members.filter(m => m.referrals > 0).length;

      // Saúde é sempre o estado de HOJE — a janela não se aplica aqui. Uma
      // safra que produziu bem nos primeiros 90 dias e depois parou precisa
      // aparecer como "produziu muito, está inativa hoje", não como saudável.
      const healthyCount = members.filter(m => m.engagementLevel === 'saudavel').length;
      const riskCount = members.filter(m => m.engagementLevel === 'risco').length;
      const inactiveCount = members.filter(m => m.engagementLevel === 'inativo').length;
      const onboardingCount = members.filter(m => m.status === 'onboarding').length;
      const scored = healthyCount + riskCount + inactiveCount;

      return {
        vintageId,
        year,
        month,
        label: `${MONTH_NAMES_PT[month - 1]}/${year}`,
        shortLabel: `${MONTH_SHORT_PT[month - 1]}/${String(year).slice(2)}`,
        startDate: `${vintageId}-01`,
        endDate: `${vintageId}-${String(lastDay).padStart(2, '0')}`,
        monthsSinceEntry,
        isWindowIncomplete: windowIncompleteCount > 0,
        partnerCount,
        partnersWithReferral,
        activationRate: partnerCount > 0 ? (partnersWithReferral / partnerCount) * 100 : 0,
        daysToFirstReferral: summarize(daysToFirstList),
        totalReferrals,
        referralsPerPartner: summarize(referralsPerPartnerList),
        wonDeals,
        conversionRate: totalReferrals > 0 ? (wonDeals / totalReferrals) * 100 : 0,
        conversionByPartner: summarize(conversionList),
        wonVolume,
        activeWonVolume,
        churnedVolume,
        healthyCount,
        riskCount,
        inactiveCount,
        onboardingCount,
        healthRate: scored > 0 ? (healthyCount / scored) * 100 : 0,
        engagement: engagementList.length > 0 ? summarize(engagementList) : EMPTY_STAT_SUMMARY,
        members
      };
    });

  return {
    vintages,
    windowDays,
    partnersWithoutJoinedDate,
    totalPartnersInVintages: vintages.reduce((sum, v) => sum + v.partnerCount, 0)
  };
}

/**
 * Melhor e pior safra num critério, ignorando safras pequenas demais para
 * dizerem alguma coisa (uma safra de 1 parceiro vira sempre 0% ou 100%).
 */
export function rankPartnerVintages(
  vintages: PartnerVintage[],
  metric: (v: PartnerVintage) => number | null,
  minPartners: number = 2
): { best: PartnerVintage | null; worst: PartnerVintage | null } {
  const eligible = vintages
    .filter(v => v.partnerCount >= minPartners)
    .map(v => ({ v, value: metric(v) }))
    .filter((x): x is { v: PartnerVintage; value: number } => x.value !== null);

  if (eligible.length === 0) return { best: null, worst: null };

  const sorted = [...eligible].sort((a, b) => b.value - a.value);
  return { best: sorted[0].v, worst: sorted[sorted.length - 1].v };
}

/** Exporta o comparativo de safras de parceiro em CSV para Excel brasileiro. */
export function exportPartnerVintageCSV(report: PartnerVintageReport): void {
  const num = (v: number | null | undefined, digits = 1): string =>
    v === null || v === undefined || !Number.isFinite(v) ? '' : v.toFixed(digits).replace('.', ',');

  const headers = [
    'Safra (Mês de Entrada)',
    'Início',
    'Fim',
    'Idade da Safra (meses)',
    'Parceiros na Safra',
    'Parceiros que Indicaram',
    'Taxa de Ativação (%)',
    'Indicações Totais',
    'Indicações por Parceiro (Média)',
    'Indicações por Parceiro (Mediana)',
    'Ciclo Entrada -> 1ª Indicação (Média, dias)',
    'Ciclo Entrada -> 1ª Indicação (Mediana, dias)',
    'Negócios Ganhos',
    'Conversão Agregada da Safra (%)',
    'Conversão por Parceiro (Média, %)',
    'Conversão por Parceiro (Mediana, %)',
    'MRR Ganho (R$)',
    'MRR Ativo Hoje (R$)',
    'MRR Cancelado (R$)',
    'Saudáveis Hoje',
    'Em Risco Hoje',
    'Inativos Hoje',
    'Saúde da Safra (%)',
    'Engajamento (Média)',
    'Engajamento (Mediana)',
    'Janela Incompleta'
  ];

  const rows = report.vintages.map(v => [
    v.label,
    v.startDate,
    v.endDate,
    v.monthsSinceEntry,
    v.partnerCount,
    v.partnersWithReferral,
    num(v.activationRate),
    v.totalReferrals,
    num(v.referralsPerPartner.mean, 2),
    num(v.referralsPerPartner.median, 2),
    num(v.daysToFirstReferral.mean, 0),
    num(v.daysToFirstReferral.median, 0),
    v.wonDeals,
    num(v.conversionRate),
    num(v.conversionByPartner.mean),
    num(v.conversionByPartner.median),
    num(v.wonVolume, 2),
    num(v.activeWonVolume, 2),
    num(v.churnedVolume, 2),
    v.healthyCount,
    v.riskCount,
    v.inactiveCount,
    num(v.healthRate),
    num(v.engagement.mean),
    num(v.engagement.median),
    v.isWindowIncomplete ? 'Sim' : 'Não'
  ]);

  const windowLabel = report.windowDays === null
    ? 'Vida inteira do parceiro (sem janela)'
    : `Primeiros ${report.windowDays} dias de programa de cada parceiro`;

  const csvContent = '﻿' + [
    'Comparativo de Safras de Parceiro (agrupamento por mês de entrada no programa)',
    `Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
    `Janela de produção considerada: ${windowLabel}`,
    'Saúde e engajamento refletem sempre o estado de hoje, independentemente da janela.',
    `Parceiros sem data de entrada (fora de qualquer safra): ${report.partnersWithoutJoinedDate}`,
    '',
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `safras_de_parceiro_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
