-- Rode este script no Supabase: Dashboard > SQL Editor > New query > Run.
--
-- Rastreamento de churn: cliente fechou (deal_status continua 'ganho', não
-- reescrevemos o histórico) e depois cancelou. churned_at preenchido = parou
-- de contar como MRR ativo (ver src/utils/channelMetrics.ts:isActiveWon).
alter table referrals
  add column if not exists churned_at date,
  add column if not exists churn_reason text;
