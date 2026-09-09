import type { Referral, CommissionInstallment } from '../types';
import { GOOGLE_DRIVE_CONFIG } from '../data/plansData';

/**
 * Safely adds N months to a YYYY-MM-DD date string preserving the day of month.
 */
export function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // 0-indexed
  const day = parseInt(dayStr, 10);

  const targetDate = new Date(year, month + monthsToAdd, day);
  // In case of day overflow (e.g. Feb 30), adjust to last day of month
  if (targetDate.getMonth() !== ((month + monthsToAdd) % 12 + 12) % 12) {
    targetDate.setDate(0);
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates default first invoice due date based on close date and due day
 */
export function calculateFirstInvoiceDueDate(closeDateStr: string, dueDay: number): string {
  if (!closeDateStr || !closeDateStr.includes('-')) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
  }

  const [yearStr, monthStr, dayStr] = closeDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const closeDay = parseInt(dayStr, 10);

  // If due day is after close day, it falls in current month; otherwise next month
  let invoiceDate: Date;
  if (dueDay >= closeDay) {
    invoiceDate = new Date(year, month, dueDay);
  } else {
    invoiceDate = new Date(year, month + 1, dueDay);
  }

  const y = invoiceDate.getFullYear();
  const m = String(invoiceDate.getMonth() + 1).padStart(2, '0');
  const d = String(invoiceDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates commission installments according to business rules:
 * - Mensal: 3 parts (1/3 each) at 1st, 3rd, and 5th monthly invoices (1ª, 3ª e 5ª mensalidades)
 * - Anual: Follows client payment:
 *   - 1x (À vista): 1 installment (100%) at 1st invoice
 *   - 2x: 2 installments (50% each) at 1st and 2nd invoice
 *   - 3x: 3 installments (33.33% each) at 1st, 2nd, and 3rd invoice
 */
export function generateCommissionInstallments(
  referralId: string,
  partnerId: string,
  partnerName: string,
  clientName: string,
  totalCommission: number,
  planRecurrence: 'mensal' | 'anual',
  planInstallments: '1x' | '2x' | '3x' = '1x',
  firstInvoiceDueDate: string
): CommissionInstallment[] {
  if (!totalCommission || totalCommission <= 0) return [];

  const installments: CommissionInstallment[] = [];

  if (planRecurrence === 'mensal') {
    // 3 installments: 1/3 at 1st month, 1/3 at 3rd month (+2 mo), 1/3 at 5th month (+4 mo)
    const basePart = Math.floor((totalCommission / 3) * 100) / 100;
    const remainder = parseFloat((totalCommission - basePart * 2).toFixed(2));

    const parts = [
      { num: 1, monthsOffset: 0, label: '1ª mensalidade (1/3)', value: basePart },
      { num: 2, monthsOffset: 2, label: '3ª mensalidade (1/3)', value: basePart },
      { num: 3, monthsOffset: 4, label: '5ª mensalidade (1/3)', value: remainder }
    ];

    parts.forEach(p => {
      installments.push({
        id: `inst-${referralId}-${p.num}-${Math.random().toString(36).substring(2, 6)}`,
        referralId,
        partnerId,
        partnerName,
        clientName,
        installmentNumber: p.num,
        totalInstallments: 3,
        triggerDescription: p.label,
        value: p.value,
        releaseDate: addMonthsToDate(firstInvoiceDueDate, p.monthsOffset),
        status: 'a_liberar',
        partnerNotified: false
      });
    });
  } else {
    // Anual: depends on client installments (1x, 2x, 3x)
    if (planInstallments === '2x') {
      const part1 = Math.floor((totalCommission / 2) * 100) / 100;
      const part2 = parseFloat((totalCommission - part1).toFixed(2));

      installments.push({
        id: `inst-${referralId}-1-${Math.random().toString(36).substring(2, 6)}`,
        referralId,
        partnerId,
        partnerName,
        clientName,
        installmentNumber: 1,
        totalInstallments: 2,
        triggerDescription: '1ª parcela anual (50%)',
        value: part1,
        releaseDate: firstInvoiceDueDate,
        status: 'a_liberar',
        partnerNotified: false
      });

      installments.push({
        id: `inst-${referralId}-2-${Math.random().toString(36).substring(2, 6)}`,
        referralId,
        partnerId,
        partnerName,
        clientName,
        installmentNumber: 2,
        totalInstallments: 2,
        triggerDescription: '2ª parcela anual (50%)',
        value: part2,
        releaseDate: addMonthsToDate(firstInvoiceDueDate, 1),
        status: 'a_liberar',
        partnerNotified: false
      });
    } else if (planInstallments === '3x') {
      const basePart = Math.floor((totalCommission / 3) * 100) / 100;
      const lastPart = parseFloat((totalCommission - basePart * 2).toFixed(2));

      [0, 1, 2].forEach(idx => {
        installments.push({
          id: `inst-${referralId}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
          referralId,
          partnerId,
          partnerName,
          clientName,
          installmentNumber: idx + 1,
          totalInstallments: 3,
          triggerDescription: `${idx + 1}ª parcela anual (1/3)`,
          value: idx === 2 ? lastPart : basePart,
          releaseDate: addMonthsToDate(firstInvoiceDueDate, idx),
          status: 'a_liberar',
          partnerNotified: false
        });
      });
    } else {
      // 1x (À vista)
      installments.push({
        id: `inst-${referralId}-1-${Math.random().toString(36).substring(2, 6)}`,
        referralId,
        partnerId,
        partnerName,
        clientName,
        installmentNumber: 1,
        totalInstallments: 1,
        triggerDescription: 'À vista anual (100%)',
        value: totalCommission,
        releaseDate: firstInvoiceDueDate,
        status: 'a_liberar',
        partnerNotified: false
      });
    }
  }

  return installments;
}

/**
 * Calculates overall referral commission status based on its installments
 */
export function updateReferralCommissionStatusFromInstallments(referral: Referral): Referral {
  if (!referral.commissionInstallments || referral.commissionInstallments.length === 0) {
    return referral;
  }

  const allPaid = referral.commissionInstallments.every(i => i.status === 'paga');
  const anyActive = referral.commissionInstallments.some(i => ['a_liberar', 'solicitada', 'agendada'].includes(i.status));

  if (allPaid) {
    return {
      ...referral,
      commissionStatus: 'paga'
    };
  } else if (anyActive) {
    return {
      ...referral,
      commissionStatus: 'a_pagar'
    };
  }

  return referral;
}
