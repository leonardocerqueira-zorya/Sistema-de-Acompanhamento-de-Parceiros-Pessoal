import type {
  ChannelCostEntry,
  CommissionInstallment,
  MrrChannelBreakdownItem,
  NewMrrEntry,
  Partner,
  Referral
} from '../types';

// ---------------------------------------------------------------------------
// Tradução domínio <-> linha do Supabase (camelCase <-> snake_case).
//
// Vive separado do repository.ts de propósito: estas funções são puras e não
// encostam em supabaseClient (import.meta.env, só existe no Vite) nem em
// localStorage. Isso permite que o servidor MCP em mcp-server/ leia as mesmas
// tabelas em Node reaproveitando ESTE mapeamento, em vez de manter uma segunda
// cópia que silenciosamente diverge quando uma coluna nova entra no schema.
//
// O repository.ts reexporta tudo isso, então nada no app precisou mudar.
// ---------------------------------------------------------------------------

export function undef<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

export function numOrUndef(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(n) ? undefined : n;
}


export type Row = Record<string, unknown>;

export function partnerToRow(p: Partner): Row {
  return {
    id: p.id,
    id_conexa: p.idConexa ?? null,
    document: p.document ?? null,
    name: p.name,
    profile: p.profile ?? null,
    tier: p.tier ?? null,
    ambassador_id: p.ambassadorId ?? null,
    responsible_person: p.responsiblePerson ?? null,
    account_owner: p.accountOwner ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    company: p.company ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    joined_date: p.joinedDate ?? null,
    status: p.status,
    has_signed_contract: p.hasSignedContract ?? null,
    notes: p.notes ?? null
  };
}

export function rowToPartner(r: Row): Partner {
  return {
    id: String(r.id),
    idConexa: undef(r.id_conexa as string),
    document: undef(r.document as string),
    name: (r.name as string) ?? '',
    profile: undef(r.profile as Partner['profile']),
    tier: undef(r.tier as string),
    ambassadorId: undef(r.ambassador_id as string),
    responsiblePerson: undef(r.responsible_person as string),
    accountOwner: undef(r.account_owner as string),
    email: undef(r.email as string),
    phone: undef(r.phone as string),
    company: undef(r.company as string),
    city: undef(r.city as string),
    state: undef(r.state as string),
    joinedDate: undef(r.joined_date as string),
    status: (r.status as Partner['status']) ?? 'ativo',
    hasSignedContract: undef(r.has_signed_contract as boolean),
    notes: undef(r.notes as string)
  };
}

export function referralToRow(r: Referral): Row {
  return {
    id: r.id,
    id_conexa: r.idConexa ?? null,
    partner_id: r.partnerId,
    partner_name: r.partnerName ?? null,
    client_name: r.clientName ?? null,
    client_document: r.clientDocument ?? null,
    responsible_person: r.responsiblePerson ?? null,
    client_company: r.clientCompany ?? null,
    client_email: r.clientEmail ?? null,
    client_phone: r.clientPhone ?? null,
    referral_date: r.referralDate ?? null,
    deal_status: r.dealStatus,
    loss_reason: r.lossReason ?? null,
    plan_id: r.planId ?? null,
    plan_recurrence: r.planRecurrence ?? null,
    plan_installments: r.planInstallments ?? null,
    mrr_gross: r.mrrGross ?? null,
    discount_percent: r.discountPercent ?? null,
    discount_value: r.discountValue ?? null,
    mrr_net: r.mrrNet ?? null,
    deal_value: r.dealValue ?? null,
    gross_deal_value: r.grossDealValue ?? null,
    close_date: r.closeDate ?? null,
    invoice_due_day: r.invoiceDueDay ?? null,
    first_invoice_due_date: r.firstInvoiceDueDate ?? null,
    churned_at: r.churnedAt ?? null,
    churn_reason: r.churnReason ?? null,
    commission_percent: r.commissionPercent ?? null,
    commission_value: r.commissionValue ?? null,
    commission_status: r.commissionStatus ?? null,
    commission_paid_date: r.commissionPaidDate ?? null,
    payment_method: r.paymentMethod ?? null,
    notes: r.notes ?? null,
    commission_installments: r.commissionInstallments ?? [],
    ambassador_id: r.ambassadorId ?? null,
    ambassador_name: r.ambassadorName ?? null,
    ambassador_commission_status: r.ambassadorCommissionStatus ?? null,
    ambassador_commission_installments: r.ambassadorCommissionInstallments ?? [],
    is_placeholder: r.isPlaceholder ?? false
  };
}

export function rowToReferral(r: Row): Referral {
  return {
    id: String(r.id),
    idConexa: undef(r.id_conexa as string),
    partnerId: (r.partner_id as string) ?? '',
    partnerName: (r.partner_name as string) ?? '',
    clientName: (r.client_name as string) ?? '',
    clientDocument: undef(r.client_document as string),
    responsiblePerson: undef(r.responsible_person as string),
    clientCompany: undef(r.client_company as string),
    clientEmail: undef(r.client_email as string),
    clientPhone: undef(r.client_phone as string),
    referralDate: undef(r.referral_date as string),
    dealStatus: (r.deal_status as Referral['dealStatus']) ?? 'novo',
    lossReason: undef(r.loss_reason as string),
    planId: undef(r.plan_id as string),
    planRecurrence: undef(r.plan_recurrence as Referral['planRecurrence']),
    planInstallments: undef(r.plan_installments as Referral['planInstallments']),
    mrrGross: numOrUndef(r.mrr_gross),
    discountPercent: numOrUndef(r.discount_percent),
    discountValue: numOrUndef(r.discount_value),
    mrrNet: numOrUndef(r.mrr_net),
    dealValue: numOrUndef(r.deal_value),
    grossDealValue: numOrUndef(r.gross_deal_value),
    closeDate: undef(r.close_date as string),
    invoiceDueDay: numOrUndef(r.invoice_due_day),
    firstInvoiceDueDate: undef(r.first_invoice_due_date as string),
    churnedAt: undef(r.churned_at as string),
    churnReason: undef(r.churn_reason as string),
    commissionPercent: numOrUndef(r.commission_percent),
    commissionValue: numOrUndef(r.commission_value),
    commissionStatus: (r.commission_status as Referral['commissionStatus']) ?? 'pendente_fechamento',
    commissionPaidDate: undef(r.commission_paid_date as string),
    paymentMethod: undef(r.payment_method as string),
    notes: undef(r.notes as string),
    commissionInstallments: (r.commission_installments as CommissionInstallment[]) ?? [],
    ambassadorId: undef(r.ambassador_id as string),
    ambassadorName: undef(r.ambassador_name as string),
    ambassadorCommissionStatus: undef(r.ambassador_commission_status as Referral['ambassadorCommissionStatus']),
    ambassadorCommissionInstallments: (r.ambassador_commission_installments as CommissionInstallment[]) ?? [],
    isPlaceholder: (r.is_placeholder as boolean) ?? false
  };
}

export function costToRow(e: ChannelCostEntry): Row {
  return { id: e.id, period: e.period, total_cost: e.totalCost, notes: e.notes ?? null };
}

export function rowToCost(r: Row): ChannelCostEntry {
  return {
    id: String(r.id),
    period: r.period as string,
    totalCost: numOrUndef(r.total_cost) ?? 0,
    notes: undef(r.notes as string),
    updatedAt: (r.updated_at as string) ?? new Date().toISOString()
  };
}

export function mrrToRow(e: NewMrrEntry): Row {
  return {
    id: e.id,
    period: e.period,
    total_new_mrr: e.totalNewMrr,
    total_new_deals_count: e.totalNewDealsCount ?? null,
    other_channels: e.otherChannels ?? [],
    notes: e.notes ?? null
  };
}

export function rowToMrr(r: Row): NewMrrEntry {
  return {
    id: String(r.id),
    period: r.period as string,
    totalNewMrr: numOrUndef(r.total_new_mrr) ?? 0,
    totalNewDealsCount: numOrUndef(r.total_new_deals_count),
    otherChannels: (r.other_channels as MrrChannelBreakdownItem[]) ?? [],
    notes: undef(r.notes as string),
    updatedAt: (r.updated_at as string) ?? new Date().toISOString()
  };
}
