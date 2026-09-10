import type { Partner, PartnerStatus, Referral } from '../types';

// ---------------------------------------------------------------------------
// Engajamento do parceiro.
//
// O parceiro entra com 100% e decai todo dia. Sem nenhuma indicação, chega a
// 0% em 90 dias e é considerado inativo. Cada indicação recupera 30pp.
//
// Constantes num só lugar: a régua é uma decisão de negócio e vai ser ajustada.
// ---------------------------------------------------------------------------

export const ENGAGEMENT_ZERO_DAYS = 90; // dias sem indicação até zerar
export const ENGAGEMENT_DECAY_PER_DAY = 100 / ENGAGEMENT_ZERO_DAYS; // ~1,111 pp/dia
export const ENGAGEMENT_REFERRAL_BOOST = 30; // pp por indicação registrada
export const ENGAGEMENT_RISK_THRESHOLD = 20; // <= 20% conta como "em risco"
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
      daysSinceActivity: null
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
    daysSinceActivity: Math.max(0, now - cursor)
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
 * Status que o engajamento impõe, ou null para "não mexer".
 *
 * Só desce para inativo em 0% e só volta para ativo quando o score saiu do
 * zero — o que, na prática, só acontece por uma indicação nova. Parceiro
 * inativado à mão e sem indicação recente tem score 0 e continua inativo.
 * Parceiro sem data de entrada nunca é tocado.
 */
export function statusFromEngagement(
  partner: Partner,
  engagement: PartnerEngagement
): PartnerStatus | null {
  if (engagement.score === null) return null;

  if (engagement.score <= 0) {
    return partner.status === 'inativo' ? null : 'inativo';
  }

  return partner.status === 'inativo' ? 'ativo' : null;
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
    const next = statusFromEngagement(p, engagement);
    if (!next || next === p.status) return p;
    changed.push({ partner: p, from: p.status, to: next });
    return { ...p, status: next };
  });

  return { partners: changed.length > 0 ? updated : partners, changed };
}
