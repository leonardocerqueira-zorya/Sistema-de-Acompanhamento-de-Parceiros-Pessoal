import type { Referral } from '../types';
import { MONTH_NAMES_PT, MONTH_SHORT_PT } from './dateLabels';

export interface MonthlyChurn {
  monthKey: string; // '2026-01'
  monthLabel: string; // 'Janeiro/2026'
  shortLabel: string; // 'Jan/26'
  churnedCount: number;
  churnedVolume: number; // R$ dealValue somado
  referrals: Referral[]; // Indicações canceladas neste mês
}

// Agrupa cancelamentos (churnedAt) pelos últimos N meses — mesmo espírito do
// calculateReferralVintages, mas por mês de CANCELAMENTO, não de indicação.
export function calculateMonthlyChurn(
  referrals: Referral[],
  currentDate: Date = new Date(),
  monthsCount: number = 12
): MonthlyChurn[] {
  const currentY = currentDate.getFullYear();
  const currentM = currentDate.getMonth() + 1; // 1-indexed

  const monthDates: { year: number; month: number }[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    let m = currentM - i;
    let y = currentY;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    monthDates.push({ year: y, month: m });
  }

  const churnedByMonth = new Map<string, Referral[]>();
  referrals.forEach(r => {
    if (!r.churnedAt) return;
    const key = r.churnedAt.slice(0, 7); // 'YYYY-MM'
    if (!churnedByMonth.has(key)) churnedByMonth.set(key, []);
    churnedByMonth.get(key)!.push(r);
  });

  return monthDates.map(({ year, month }) => {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthReferrals = churnedByMonth.get(monthKey) || [];
    const churnedVolume = monthReferrals.reduce((sum, r) => sum + (Number(r.dealValue) || 0), 0);

    return {
      monthKey,
      monthLabel: `${MONTH_NAMES_PT[month - 1]}/${year}`,
      shortLabel: `${MONTH_SHORT_PT[month - 1]}/${String(year).slice(2)}`,
      churnedCount: monthReferrals.length,
      churnedVolume,
      referrals: monthReferrals
    };
  });
}
