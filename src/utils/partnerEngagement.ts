import type { Partner, PartnerStatus, Referral } from '../types';

// ---------------------------------------------------------------------------
// Engajamento do parceiro.
//
// O parceiro entra com 100% e decai todo dia. Sem nenhuma indicação, chega a
// 0% em 90 dias e é considerado inativo. Cada indicação recupera 35pp.
//
// O campo Status do parceiro sai daqui — ver statusFromEngagement no fim do
// arquivo. A tela não escolhe status à mão.
//
// Constantes num só lugar: a régua é uma decisão de negócio e vai ser ajustada.
// ---------------------------------------------------------------------------

export const ENGAGEMENT_ZERO_DAYS = 90; // dias sem indicação até zerar
export const ENGAGEMENT_DECAY_PER_DAY = 100 / ENGAGEMENT_ZERO_DAYS; // ~1,111 pp/dia
// 35pp, e não 30, de propósito: 30 dias de decaimento custam 33,3pp, então um
// bônus de 30 deixaria saldo negativo (-3,3pp/mês) e o parceiro que cumpre a
// meta de 1 indicação por mês acabaria inativado. Com 35 o ritmo mensal fica
// levemente positivo (+1,7pp/mês).
export const ENGAGEMENT_REFERRAL_BOOST = 35; // pp por indicação registrada
export const ENGAGEMENT_RISK_THRESHOLD = 20; // <= 20% conta como "em risco"
// Prazo do onboarding: o parceiro tem 45 dias desde a entrada para registrar a
// primeira indicação. Passou disso sem indicar, deixa de ser parceiro novo e
// cai em inativo — mesmo com engajamento sobrando (45 dias custam 50pp).
export const ENGAGEMENT_ONBOARDING_MAX_DAYS = 45;
export const ENGAGEMENT_MAX = 100;

export type EngagementLevel =
  | 'saudavel'
  | 'risco'
  | 'inativo'
  | 'sem-dados'; // sem data de entrada: não há de quando decair

export interface PartnerEngagement {
  partnerId: string;
  partnerName: string;
  /** null quando não há data de entrada — NUNCA 0 nesse caso. */
  score: number | null;
  level: EngagementLevel;
  referralCount: number;
  lastReferralDate: string | null;
  daysSinceLastReferral: number | null;
  /** Data de onde o decaimento parte (entrada do parceiro). */
  anchorDate: string | null;
  /** Dias desde a última atividade (indicação, ou a entrada se nunca indicou). */
  daysSinceActivity: number | null;
  /** Dias corridos desde a entrada no programa — prazo do onboarding sai daqui. */
  daysSinceJoined: number | null;
}

function toUtcDays(iso: string): number | null {
  // Datas do sistema são YYYY-MM-DD; comparar em UTC evita o fuso mexer no dia.
  const parsed = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 86400000);
}

function todayUtcDays(today?: Date): number {
  const d = today ?? new Date();
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000
  );
}

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > ENGAGEMENT_MAX) return ENGAGEMENT_MAX;
  return value;
}

// Data que representa "o parceiro indicou": a data da indicação. Se ela não
// foi preenchida, cai para a data de fechamento — sem nenhuma das duas, a
// indicação não tem lugar na linha do tempo (mas ainda é contada no total).
function referralTimelineDate(r: Referral): string | null {
  return r.referralDate || r.closeDate || null;
}

export function levelForScore(score: number | null): EngagementLevel {
  if (score === null) return 'sem-dados';
  if (score <= 0) return 'inativo';
  if (score <= ENGAGEMENT_RISK_THRESHOLD) return 'risco';
  return 'saudavel';
}

export function calculatePartnerEngagement(
  partner: Partner,
  referrals: Referral[],
  today?: Date
): PartnerEngagement {
  const partnerReferrals = referrals.filter(r => r.partnerId === partner.id);
  const referralCount = partnerReferrals.length;

  const dated = partnerReferrals
    .map(r => ({ referral: r, day: referralTimelineDate(r) ? toUtcDays(referralTimelineDate(r)!) : null }))
    .filter((x): x is { referral: Referral; day: number } => x.day !== null)
    .sort((a, b) => a.day - b.day);

  const lastDated = dated.length > 0 ? dated[dated.length - 1] : null;
  const now = todayUtcDays(today);

  const lastReferralDate = lastDated ? referralTimelineDate(lastDated.referral) : null;
  const daysSinceLastReferral = lastDated ? now - lastDated.day : null;

  const anchorDay = partner.joinedDate ? toUtcDays(partner.joinedDate) : null;

  // Sem data de entrada não existe ponto de partida para o decaimento. Assumir
  // qualquer padrão aqui inativaria a base inteira de uma vez — então o score
  // fica indefinido e o parceiro sai das médias.
  if (anchorDay === null) {
    return {
      partnerId: partner.id,
      partnerName: partner.name,
      score: null,
      level: 'sem-dados',
      referralCount,
      lastReferralDate,
      daysSinceLastReferral,
      anchorDate: null,
      daysSinceActivity: null,
      daysSinceJoined: null
    };
  }

  let score = ENGAGEMENT_MAX;
  let cursor = anchorDay;

  for (const { day } of dated) {
    // Indicação anterior à entrada não retrocede a linha do tempo.
    if (day <= cursor) {
      score = clampScore(score + ENGAGEMENT_REFERRAL_BOOST);
      continue;
    }
    score = clampScore(score - (day - cursor) * ENGAGEMENT_DECAY_PER_DAY);
    score = clampScore(score + ENGAGEMENT_REFERRAL_BOOST);
    cursor = day;
  }

  // Decaimento do último evento até hoje. Data futura não adianta o relógio.
  if (now > cursor) {
    score = clampScore(score - (now - cursor) * ENGAGEMENT_DECAY_PER_DAY);
  }

  const rounded = Math.round(score * 10) / 10;

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    score: rounded,
    level: levelForScore(rounded),
    referralCount,
    lastReferralDate,
    daysSinceLastReferral,
    anchorDate: partner.joinedDate ?? null,
    daysSinceActivity: Math.max(0, now - cursor),
    daysSinceJoined: Math.max(0, now - anchorDay)
  };
}

export interface ChannelHealth {
  /** Média só dos parceiros com score calculável; null se não há nenhum. */
  average: number | null;
  scoredCount: number; // parceiros com data de entrada
  missingDataCount: number; // sem data de entrada (fora da média)
  healthyCount: number;
  riskCount: number;
  inactiveCount: number;
  byPartner: PartnerEngagement[];
}

export function calculateChannelHealth(
  partners: Partner[],
  referrals: Referral[],
  today?: Date
): ChannelHealth {
  const byPartner = partners.map(p => calculatePartnerEngagement(p, referrals, today));

  const scored = byPartner.filter(e => e.score !== null);
  const sum = scored.reduce((acc, e) => acc + (e.score ?? 0), 0);

  return {
    average: scored.length > 0 ? Math.round((sum / scored.length) * 10) / 10 : null,
    scoredCount: scored.length,
    missingDataCount: byPartner.length - scored.length,
    healthyCount: byPartner.filter(e => e.level === 'saudavel').length,
    riskCount: byPartner.filter(e => e.level === 'risco').length,
    inactiveCount: byPartner.filter(e => e.level === 'inativo').length,
    byPartner
  };
}

// ---------------------------------------------------------------------------
// Status automático
// ---------------------------------------------------------------------------

/**
 * Status que a régua de saúde impõe, ou null quando ela não tem o que dizer.
 *
 * A régua cobre os quatro status, então o campo não precisa de escolha manual:
 *
 *   score = 0                                  -> inativo
 *   nenhuma indicação, até 45 dias de entrada  -> onboarding
 *   nenhuma indicação, passados os 45 dias     -> risco
 *   indicou, mas score <= 20%                  -> risco
 *   indicou e score > 20%                      -> ativo
 *
 * Onboarding é uma janela, não um estado permanente: tem prazo de
 * ENGAGEMENT_ONBOARDING_MAX_DAYS dias e não volta depois da primeira
 * indicação. Vencido o prazo sem indicar, o parceiro entra em risco — e NÃO em
 * inativo: o prazo de inativação continua sendo os ENGAGEMENT_ZERO_DAYS dias
 * de decaimento, igual para todo mundo. Aos 45 dias o score está em ~50%, e
 * "risco" é o aviso de que a janela fechou sem a primeira indicação.
 *
 * Para quem já indicou, o risco é o mesmo limiar que a barra de engajamento
 * mostra (ENGAGEMENT_RISK_THRESHOLD): o status não pode dizer "Ativo" enquanto
 * a barra ao lado diz "Em risco".
 *
 * Sem data de entrada não existe ponto de partida para o decaimento nem para o
 * prazo — o score é indefinido, esta função devolve null e o status gravado
 * fica como está. Assumir um padrão aqui inativaria a base inteira de uma vez.
 */
export function statusFromEngagement(engagement: PartnerEngagement): PartnerStatus | null {
  if (engagement.score === null) return null;
  if (engagement.score <= 0) return 'inativo';

  if (engagement.referralCount === 0) {
    return (engagement.daysSinceJoined ?? 0) <= ENGAGEMENT_ONBOARDING_MAX_DAYS
      ? 'onboarding'
      : 'risco';
  }

  return engagement.score <= ENGAGEMENT_RISK_THRESHOLD ? 'risco' : 'ativo';
}

// Rótulo e cor do status ficam junto da régua que os produz: são três telas
// pintando o mesmo badge (Parceiros, Carteiras e o cadastro), e status novo
// esquecido em uma delas aparecia como texto cru sem cor.
export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  ativo: 'Ativo',
  onboarding: 'Em Onboarding',
  risco: 'Em Risco',
  inativo: 'Inativo'
};

export const PARTNER_STATUS_BADGE: Record<PartnerStatus, string> = {
  ativo: 'bg-zry-positive-bg text-zry-positive',
  onboarding: 'bg-zry-info-bg text-zry-info',
  risco: 'bg-zry-warning-bg text-zry-warning',
  inativo: 'bg-zry-lilas text-zry-text-2'
};

/** Atalho para a tela: engajamento + régua num passo. null = régua sem dados. */
export function derivePartnerStatus(
  partner: Partner,
  referrals: Referral[],
  today?: Date
): PartnerStatus | null {
  return statusFromEngagement(calculatePartnerEngagement(partner, referrals, today));
}

/** Aplica o status automático na lista. Devolve o que mudou, para avisar. */
export function applyEngagementStatus(
  partners: Partner[],
  referrals: Referral[],
  today?: Date
): { partners: Partner[]; changed: Array<{ partner: Partner; from: PartnerStatus; to: PartnerStatus }> } {
  const changed: Array<{ partner: Partner; from: PartnerStatus; to: PartnerStatus }> = [];

  const updated = partners.map(p => {
    const engagement = calculatePartnerEngagement(p, referrals, today);
    const next = statusFromEngagement(engagement);
    if (!next || next === p.status) return p;
    changed.push({ partner: p, from: p.status, to: next });
    return { ...p, status: next };
  });

  // Mesma referência quando nada mudou: quem observa a lista não re-renderiza.
  return { partners: changed.length > 0 ? updated : partners, changed };
}
