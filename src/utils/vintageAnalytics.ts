import type { Referral, ReferralVintage, MonthlyClosedBreakdown } from '../types';
import { dispatchNotification } from '../services/notificationService';
import { formatCurrency } from './analytics';

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MONTH_SHORT_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Calculates referral vintages (safras) for the past N months.
 * A referral is part of a vintage if its referralDate is between the 1st and last day of that month.
 * The cutoff date is the 15th of the following month (e.g., Aug/26 vintage cuts off on 15/09/2026).
 */
export function calculateReferralVintages(
  referrals: Referral[],
  currentDate: Date = new Date(),
  monthsCount: number = 12
): ReferralVintage[] {
  const currentY = currentDate.getFullYear();
  const currentM = currentDate.getMonth() + 1; // 1-indexed
  const todayStr = currentDate.toISOString().slice(0, 10);

  // Generate list of vintage months (e.g. from 11 months ago up to current month)
  const vintageDates: { year: number; month: number }[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    let m = currentM - i;
    let y = currentY;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    vintageDates.push({ year: y, month: m });
  }

  // Pre-index referrals by vintage key "YYYY-MM"
  const referralsByVintage = new Map<string, Referral[]>();
  referrals.forEach(r => {
    const dateStr = r.referralDate || r.closeDate;
    if (!dateStr) return;
    const clean = dateStr.trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length < 2) return;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(y) || isNaN(m)) return;

    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (!referralsByVintage.has(key)) {
      referralsByVintage.set(key, []);
    }
    referralsByVintage.get(key)!.push(r);
  });

  const vintages: ReferralVintage[] = vintageDates.map(({ year, month }) => {
    const vintageId = `${year}-${String(month).padStart(2, '0')}`;
    const label = `${MONTH_NAMES_PT[month - 1]}/${year}`;
    const shortLabel = `${MONTH_SHORT_PT[month - 1]}/${String(year).slice(2)}`;
    
    // Start & End dates of the vintage month
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // Cutoff date is the 15th of the following month
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const cutoffDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-15`;
    const cutoffLabel = `15/${String(nextMonth).padStart(2, '0')}/${nextYear}`;

    // Date comparison
    const isCutoffReached = todayStr >= cutoffDate;

    // Calculate difference in whole calendar days between today and cutoffDate (midnight to midnight)
    const cutoffDateTime = new Date(`${cutoffDate}T00:00:00Z`).getTime();
    const currentDateTime = new Date(`${todayStr}T00:00:00Z`).getTime();
    const diffDays = Math.round((cutoffDateTime - currentDateTime) / (1000 * 60 * 60 * 24));
    const isCutoffApproaching = diffDays >= 0 && diffDays <= 7;

    // Get referrals belonging to this vintage
    const vintageRefs = referralsByVintage.get(vintageId) || [];
    const totalReferrals = vintageRefs.length;

    let pipelineReferrals = 0;
    let potentialMRR = 0;

    let closedAtCutoff = 0;
    let wonVolumeAtCutoff = 0;

    let closedTotal = 0;
    let wonVolumeTotal = 0;

    let closedPostCutoff = 0;

    // Map to aggregate closed deals by their close month
    const closedMonthMap = new Map<string, { count: number; volume: number }>();

    vintageRefs.forEach(r => {
      const isWon = r.dealStatus === 'ganho';
      const isPipeline = !r.dealStatus || r.dealStatus === 'novo' || r.dealStatus === 'contato' || r.dealStatus === 'qualificado' || r.dealStatus === 'negociacao';
      const val = Number(r.dealValue) || 0;

      if (isPipeline) {
        pipelineReferrals += 1;
        potentialMRR += val;
      }

      if (isWon) {
        closedTotal += 1;
        wonVolumeTotal += val;

        const closeDateStr = (r.closeDate || r.referralDate || '').trim().slice(0, 10);
        
        // Check if closed before or on cutoff date (15th of next month)
        if (closeDateStr && closeDateStr <= cutoffDate) {
          closedAtCutoff += 1;
          wonVolumeAtCutoff += val;
        } else if (closeDateStr && closeDateStr > cutoffDate) {
          closedPostCutoff += 1;
        }

        // Aggregate by close calendar month
        if (closeDateStr) {
          const closeMonthKey = closeDateStr.slice(0, 7); // "YYYY-MM"
          const curr = closedMonthMap.get(closeMonthKey) || { count: 0, volume: 0 };
          curr.count += 1;
          curr.volume += val;
          closedMonthMap.set(closeMonthKey, curr);
        }
      }
    });

    // Conversion calculations
    const conversionAtCutoff = totalReferrals > 0 ? (closedAtCutoff / totalReferrals) * 100 : 0;
    const conversionCurrent = totalReferrals > 0 ? (closedTotal / totalReferrals) * 100 : 0;
    const postCutoffGainPercent = Math.max(0, conversionCurrent - conversionAtCutoff);
    const hasPostCutoffSales = closedPostCutoff > 0;

    // Build monthly breakdown from vintage month up to the current month
    const monthlyBreakdown: MonthlyClosedBreakdown[] = [];
    
    // We inspect all months from the vintage month up to current month (or at least 6 months)
    let iterY = year;
    let iterM = month;
    let relIdx = 0;
    
    // Maximum 12 progression months
    while (relIdx < 12) {
      const monthKey = `${iterY}-${String(iterM).padStart(2, '0')}`;
      const monthLabel = `${MONTH_SHORT_PT[iterM - 1]}/${String(iterY).slice(2)}`;
      const closedData = closedMonthMap.get(monthKey) || { count: 0, volume: 0 };

      monthlyBreakdown.push({
        monthKey,
        monthLabel,
        relativeMonthIndex: relIdx,
        closedCount: closedData.count,
        wonVolume: closedData.volume
      });

      // Stop once we surpass the current month
      if (iterY > currentY || (iterY === currentY && iterM >= currentM)) {
        break;
      }

      iterM++;
      if (iterM > 12) {
        iterM = 1;
        iterY++;
      }
      relIdx++;
    }

    return {
      vintageId,
      year,
      month,
      label,
      shortLabel,
      startDate,
      endDate,
      cutoffDate,
      cutoffLabel,
      isCutoffReached,
      daysUntilCutoff: diffDays,
      isCutoffApproaching,
      totalReferrals,
      pipelineReferrals,
      potentialMRR,
      closedAtCutoff,
      conversionAtCutoff: Number(conversionAtCutoff.toFixed(1)),
      wonVolumeAtCutoff,
      closedTotal,
      conversionCurrent: Number(conversionCurrent.toFixed(1)),
      wonVolumeTotal,
      closedPostCutoff,
      postCutoffGainPercent: Number(postCutoffGainPercent.toFixed(1)),
      hasPostCutoffSales,
      monthlyBreakdown,
      referrals: vintageRefs
    };
  });

  return vintages;
}

/**
 * Checks for vintages approaching the cutoff date and triggers notifications.
 * Dispatches notification if the cutoff is approaching (0 to 7 days away) and
 * hasn't been notified for this cutoff cycle yet.
 */
export function checkAndTriggerVintageCutoffNotifications(vintages: ReferralVintage[]): void {
  try {
    const approachingVintages = vintages.filter(v => v.isCutoffApproaching && v.pipelineReferrals > 0);
    
    approachingVintages.forEach(v => {
      const storageKey = `safra_cutoff_alert_dispatched_${v.vintageId}_${v.cutoffDate}`;
      const alreadySent = localStorage.getItem(storageKey);
      
      if (!alreadySent) {
        dispatchNotification({
          type: 'corte_safra_alerta',
          title: `Corte de Safra Próximo: ${v.label}`,
          message: `Atenção: A data de corte oficial da safra de ${v.label} encerra em ${v.cutoffLabel} (em ${v.daysUntilCutoff} dias). Há ${v.pipelineReferrals} indicação(ões) em negociação com MRR potencial de ${formatCurrency(v.potentialMRR)}.`,
          dealValue: v.potentialMRR
        });

        localStorage.setItem(storageKey, new Date().toISOString());
      }
    });
  } catch (err) {
    console.error('Erro ao verificar alertas de corte de safra', err);
  }
}

/**
 * Exports vintage cohort report to CSV formatted for Brazilian Excel.
 */
export function exportVintageReportCSV(vintages: ReferralVintage[]): void {
  const headers = [
    'Safra (Mês/Ano)',
    'Data Início',
    'Data Fim',
    'Data de Corte (15 m+1)',
    'Status do Corte',
    'Total Indicações',
    'Em Negociação (Pipeline)',
    'MRR Potencial (R$)',
    'Fechadas no Corte (15 m+1)',
    'Tx Conversão no Corte (%)',
    'Fechadas Total (Atual)',
    'Tx Conversão Atual (%)',
    'Vendas Pós-Corte',
    'Ganho Pós-Corte (%)',
    'MRR Total Ganho (R$)'
  ];

  const rows = vintages.map(v => [
    v.label,
    v.startDate,
    v.endDate,
    v.cutoffLabel,
    v.isCutoffReached ? 'Corte Realizado' : `Corte em ${v.daysUntilCutoff} dias`,
    v.totalReferrals,
    v.pipelineReferrals,
    v.potentialMRR.toFixed(2).replace('.', ','),
    v.closedAtCutoff,
    `${v.conversionAtCutoff.toFixed(1)}%`,
    v.closedTotal,
    `${v.conversionCurrent.toFixed(1)}%`,
    v.closedPostCutoff,
    `${v.postCutoffGainPercent.toFixed(1)}%`,
    v.wonVolumeTotal.toFixed(2).replace('.', ',')
  ]);

  const csvContent = '\uFEFF' + [
    'Relatório de Desempenho por Safras de Indicação e Maturação de Cortes',
    `Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
    'Regra de Negócio: Corte oficial gravado no dia 15 do mês subsequente (D+15)',
    '',
    headers.join(';'),
    ...rows.map(r => r.join(';'))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `relatorio_safras_indicacoes_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
