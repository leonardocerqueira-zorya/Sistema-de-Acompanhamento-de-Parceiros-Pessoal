import type { Referral, CommissionInstallment, Partner } from '../types';
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
  firstInvoiceDueDate: string,
  kind: 'parceiro' | 'embaixador' = 'parceiro'
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

  return installments.map(i => ({ ...i, kind }));
}

/**
 * Generates the ambassador's commission installments (Partner.ambassadorId flow):
 * - Mensal: 100% liberado em 3 partes (1/3 cada) nas mensalidades 7, 9 e 11 do cliente
 *   (sempre depois do parceiro indicador, cuja última parcela é na 5ª mensalidade).
 * - Anual: segue exatamente a mesma regra do parceiro indicador (à vista, 2x ou 3x),
 *   já que não há "mensalidades" do cliente pra escalonar.
 */
export function generateAmbassadorCommissionInstallments(
  referralId: string,
  ambassadorId: string,
  ambassadorName: string,
  clientName: string,
  totalCommission: number,
  planRecurrence: 'mensal' | 'anual',
  planInstallments: '1x' | '2x' | '3x' = '1x',
  firstInvoiceDueDate: string
): CommissionInstallment[] {
  if (!totalCommission || totalCommission <= 0) return [];

  if (planRecurrence === 'anual') {
    return generateCommissionInstallments(
      referralId,
      ambassadorId,
      ambassadorName,
      clientName,
      totalCommission,
      'anual',
      planInstallments,
      firstInvoiceDueDate,
      'embaixador'
    );
  }

  const basePart = Math.floor((totalCommission / 3) * 100) / 100;
  const remainder = parseFloat((totalCommission - basePart * 2).toFixed(2));

  const parts = [
    { num: 1, monthsOffset: 6, label: '7ª mensalidade (1/3) — Embaixador', value: basePart },
    { num: 2, monthsOffset: 8, label: '9ª mensalidade (1/3) — Embaixador', value: basePart },
    { num: 3, monthsOffset: 10, label: '11ª mensalidade (1/3) — Embaixador', value: remainder }
  ];

  return parts.map(p => ({
    id: `inst-emb-${referralId}-${p.num}-${Math.random().toString(36).substring(2, 6)}`,
    referralId,
    partnerId: ambassadorId,
    partnerName: ambassadorName,
    kind: 'embaixador' as const,
    clientName,
    installmentNumber: p.num,
    totalInstallments: 3,
    triggerDescription: p.label,
    value: p.value,
    releaseDate: addMonthsToDate(firstInvoiceDueDate, p.monthsOffset),
    status: 'a_liberar' as const,
    partnerNotified: false
  }));
}

/**
 * Garante que um referral 'ganho' tenha as parcelas de comissão geradas — tanto do
 * parceiro indicador quanto (se aplicável) do embaixador associado a ele — sem
 * duplicar caso já existam. Idempotente: usado no carregamento inicial, após
 * importação de planilha e sempre que uma indicação for salva.
 */
export function ensureCommissionInstallmentsForReferral(referral: Referral, partners: Partner[]): Referral {
  if (referral.dealStatus !== 'ganho' || !referral.commissionValue || referral.commissionValue <= 0) {
    return referral;
  }

  const firstDue = referral.firstInvoiceDueDate || referral.closeDate;
  if (!firstDue) return referral;

  let updated = referral;

  if (!updated.commissionInstallments || updated.commissionInstallments.length === 0) {
    const insts = generateCommissionInstallments(
      updated.id,
      updated.partnerId,
      updated.partnerName,
      updated.clientName,
      updated.commissionValue,
      updated.planRecurrence || 'mensal',
      updated.planInstallments || '1x',
      firstDue
    );
    if (updated.commissionStatus === 'paga') {
      insts.forEach(i => {
        i.status = 'paga';
        i.paidDate = updated.commissionPaidDate || firstDue;
        i.paymentMethod = updated.paymentMethod || 'PIX';
      });
    }
    updated = { ...updated, commissionInstallments: insts };
  }

  if (!updated.ambassadorCommissionInstallments || updated.ambassadorCommissionInstallments.length === 0) {
    const referringPartner = partners.find(p => p.id === updated.partnerId);
    const ambassador = referringPartner?.ambassadorId
      ? partners.find(p => p.id === referringPartner.ambassadorId)
      : undefined;

    if (ambassador) {
      const ambInsts = generateAmbassadorCommissionInstallments(
        updated.id,
        ambassador.id,
        ambassador.name,
        updated.clientName,
        updated.commissionValue,
        updated.planRecurrence || 'mensal',
        updated.planInstallments || '1x',
        firstDue
      );
      if (updated.commissionStatus === 'paga') {
        ambInsts.forEach(i => {
          i.status = 'paga';
          i.paidDate = updated.commissionPaidDate || firstDue;
          i.paymentMethod = updated.paymentMethod || 'PIX';
        });
      }
      updated = {
        ...updated,
        ambassadorId: ambassador.id,
        ambassadorName: ambassador.name,
        ambassadorCommissionStatus: updated.commissionStatus === 'paga' ? 'paga' : 'a_pagar',
        ambassadorCommissionInstallments: ambInsts
      };
    }
  }

  return updated;
}

// Bônus único (não recorrente) pago ao embaixador na primeira indicação fechada
// de cada parceiro que ele trouxe pro programa — além da comissão recorrente por
// cliente indicado (generateAmbassadorCommissionInstallments).
export const AMBASSADOR_ACTIVATION_BONUS_VALUE = 100;
export const AMBASSADOR_ACTIVATION_BONUS_LABEL = 'Bônus único — Parceiro Indicado Ativado';

/**
 * Para cada parceiro com embaixador associado que já tenha ao menos uma indicação
 * ganha, garante que o embaixador recebeu o bônus único de R$100 de ativação —
 * anexado à indicação ganha mais antiga desse parceiro. Roda sobre a base inteira
 * (precisa ver todas as indicações do parceiro para não pagar duas vezes).
 */
export function backfillAmbassadorActivationBonuses(
  referrals: Referral[],
  partners: Partner[]
): { referrals: Referral[]; changed: boolean } {
  let changed = false;
  const wonByPartner = new Map<string, Referral[]>();
  referrals.forEach(r => {
    if (r.dealStatus !== 'ganho') return;
    const list = wonByPartner.get(r.partnerId) || [];
    list.push(r);
    wonByPartner.set(r.partnerId, list);
  });

  const result = [...referrals];

  partners.forEach(partner => {
    if (!partner.ambassadorId) return;
    const ambassador = partners.find(p => p.id === partner.ambassadorId);
    if (!ambassador) return;

    const wonRefs = wonByPartner.get(partner.id) || [];
    if (wonRefs.length === 0) return;

    const alreadyGiven = wonRefs.some(r =>
      (r.ambassadorCommissionInstallments || []).some(i => i.triggerDescription === AMBASSADOR_ACTIVATION_BONUS_LABEL)
    );
    if (alreadyGiven) return;

    const earliest = [...wonRefs].sort((a, b) => (a.closeDate || '').localeCompare(b.closeDate || ''))[0];
    const idx = result.findIndex(r => r.id === earliest.id);
    if (idx === -1) return;

    const releaseDate = earliest.firstInvoiceDueDate || earliest.closeDate || new Date().toISOString().slice(0, 10);
    const bonusInstallment: CommissionInstallment = {
      id: `inst-emb-bonus-${earliest.id}-${Math.random().toString(36).substring(2, 6)}`,
      referralId: earliest.id,
      partnerId: ambassador.id,
      partnerName: ambassador.name,
      kind: 'embaixador',
      clientName: earliest.clientName,
      installmentNumber: 1,
      totalInstallments: 1,
      triggerDescription: AMBASSADOR_ACTIVATION_BONUS_LABEL,
      value: AMBASSADOR_ACTIVATION_BONUS_VALUE,
      releaseDate,
      status: 'a_liberar',
      partnerNotified: false
    };

    result[idx] = {
      ...earliest,
      ambassadorId: ambassador.id,
      ambassadorName: ambassador.name,
      ambassadorCommissionInstallments: [...(earliest.ambassadorCommissionInstallments || []), bonusInstallment]
    };
    changed = true;
  });

  return { referrals: result, changed };
}

/**
 * Ponto único de entrada para manter as comissões em dia: gera parcelas do parceiro
 * indicador, parcelas recorrentes do embaixador e o bônus único de ativação, de
 * forma idempotente. Chamar sempre que a base de indicações/parceiros mudar
 * (carregamento inicial, import de planilha, salvar indicação ou parceiro).
 */
export function backfillAllCommissions(
  referrals: Referral[],
  partners: Partner[]
): { referrals: Referral[]; changed: boolean } {
  let changed = false;

  const withInstallments = referrals.map(r => {
    const updated = ensureCommissionInstallmentsForReferral(r, partners);
    if (updated !== r) changed = true;
    return updated;
  });

  const bonusResult = backfillAmbassadorActivationBonuses(withInstallments, partners);
  if (bonusResult.changed) changed = true;

  return { referrals: bonusResult.referrals, changed };
}

/**
 * Calculates overall referral commission status based on its installments —
 * both the referring partner's (commissionStatus) and, if present, the
 * ambassador's (ambassadorCommissionStatus). Each rolls up independently since
 * they're paid to different people on different schedules.
 */
export function updateReferralCommissionStatusFromInstallments(referral: Referral): Referral {
  let updated = referral;

  if (updated.commissionInstallments && updated.commissionInstallments.length > 0) {
    const allPaid = updated.commissionInstallments.every(i => i.status === 'paga');
    const anyActive = updated.commissionInstallments.some(i => ['a_liberar', 'solicitada', 'agendada'].includes(i.status));
    if (allPaid) {
      updated = { ...updated, commissionStatus: 'paga' };
    } else if (anyActive) {
      updated = { ...updated, commissionStatus: 'a_pagar' };
    }
  }

  if (updated.ambassadorCommissionInstallments && updated.ambassadorCommissionInstallments.length > 0) {
    const allPaid = updated.ambassadorCommissionInstallments.every(i => i.status === 'paga');
    const anyActive = updated.ambassadorCommissionInstallments.some(i => ['a_liberar', 'solicitada', 'agendada'].includes(i.status));
    if (allPaid) {
      updated = { ...updated, ambassadorCommissionStatus: 'paga' };
    } else if (anyActive) {
      updated = { ...updated, ambassadorCommissionStatus: 'a_pagar' };
    }
  }

  return updated;
}
