-- Rode este script no Supabase: Dashboard > SQL Editor > New query > Run.
--
-- Migração para tabelas relacionais: cada parceiro, indicação, custo e entrada
-- de MRR vira uma LINHA própria, em vez de tudo dentro de um único JSON em
-- system_backups. É isso que dá, de verdade:
--   * concorrência por registro — duas pessoas editando indicações diferentes
--     ao mesmo tempo nunca se sobrescrevem;
--   * exclusão real — apagar remove a linha, não "volta" no próximo sync;
--   * updated_at por linha, para resolver conflito do MESMO registro.
--
-- system_backups continua existindo como backup/exportação e como origem da
-- carga inicial destes dados. Ele não é mais a fonte da verdade.

-- ---------------------------------------------------------------------------
-- Parceiros
-- ---------------------------------------------------------------------------
create table if not exists partners (
  id text primary key,
  id_conexa text,
  document text,
  name text not null,
  profile text,
  tier text,
  ambassador_id text,
  responsible_person text, -- contato DENTRO do parceiro (não é o executivo)
  account_owner text,      -- executivo interno dono da carteira
  email text,
  phone text,
  company text,
  city text,
  state text,
  joined_date text,
  status text not null default 'ativo',
  notes text,
  updated_at timestamptz not null default now()
);

create index if not exists partners_account_owner_idx on partners (account_owner);

-- ---------------------------------------------------------------------------
-- Indicações
--
-- As parcelas de comissão ficam em jsonb dentro da própria indicação: elas são
-- geradas a partir dela, sempre lidas junto e nunca editadas por outra pessoa
-- em separado — normalizar em outra tabela adicionaria join e risco sem ganho.
-- ---------------------------------------------------------------------------
create table if not exists referrals (
  id text primary key,
  id_conexa text,
  partner_id text not null,
  partner_name text,
  client_name text,
  client_document text,
  responsible_person text,
  client_company text,
  client_email text,
  client_phone text,
  referral_date text,
  deal_status text not null default 'novo',
  plan_id text,
  plan_recurrence text,
  plan_installments text,
  mrr_gross numeric,
  discount_percent numeric,
  discount_value numeric,
  mrr_net numeric,
  deal_value numeric,
  gross_deal_value numeric,
  close_date text,
  invoice_due_day integer,
  first_invoice_due_date text,
  commission_percent numeric,
  commission_value numeric,
  commission_status text default 'pendente_fechamento',
  commission_paid_date text,
  payment_method text,
  notes text,
  commission_installments jsonb not null default '[]'::jsonb,
  ambassador_id text,
  ambassador_name text,
  ambassador_commission_status text,
  ambassador_commission_installments jsonb not null default '[]'::jsonb,
  is_placeholder boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists referrals_partner_id_idx on referrals (partner_id);
create index if not exists referrals_close_date_idx on referrals (close_date);

-- ---------------------------------------------------------------------------
-- Custo do canal e Novo MRR (preenchidos pelo Master, um registro por mês)
-- ---------------------------------------------------------------------------
create table if not exists channel_costs (
  id text primary key,
  period text not null unique, -- YYYY-MM
  total_cost numeric not null default 0,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists new_mrr_entries (
  id text primary key,
  period text not null unique, -- YYYY-MM
  total_new_mrr numeric not null default 0,
  total_new_deals_count integer,
  other_channels jsonb not null default '[]'::jsonb,
  notes text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Configurações compartilhadas (tabela de planos e tiers de parceiro).
-- Hoje viviam só no navegador de quem editou — agora valem para o time todo.
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  key text primary key, -- 'pricing_plans' | 'partner_tiers'
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Mantém exatamente o alcance que o time já tinha: qualquer pessoa logada lê e
-- escreve. O escopo por executivo continua sendo aplicado na interface (o blob
-- anterior também era legível por inteiro por qualquer usuário autenticado).
-- Restringir escrita por carteira no próprio banco é um passo seguinte.
-- ---------------------------------------------------------------------------
alter table partners enable row level security;
alter table referrals enable row level security;
alter table channel_costs enable row level security;
alter table new_mrr_entries enable row level security;
alter table app_settings enable row level security;

drop policy if exists "authenticated full access" on partners;
create policy "authenticated full access" on partners
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on referrals;
create policy "authenticated full access" on referrals
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on channel_costs;
create policy "authenticated full access" on channel_costs
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on new_mrr_entries;
create policy "authenticated full access" on new_mrr_entries
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated full access" on app_settings;
create policy "authenticated full access" on app_settings
  for all to authenticated using (true) with check (true);

-- updated_at sempre no relógio do servidor: é o critério de desempate entre
-- máquinas, então não pode depender do relógio de cada navegador.
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists partners_touch on partners;
create trigger partners_touch before insert or update on partners
  for each row execute function touch_updated_at();

drop trigger if exists referrals_touch on referrals;
create trigger referrals_touch before insert or update on referrals
  for each row execute function touch_updated_at();

drop trigger if exists channel_costs_touch on channel_costs;
create trigger channel_costs_touch before insert or update on channel_costs
  for each row execute function touch_updated_at();

drop trigger if exists new_mrr_entries_touch on new_mrr_entries;
create trigger new_mrr_entries_touch before insert or update on new_mrr_entries
  for each row execute function touch_updated_at();

drop trigger if exists app_settings_touch on app_settings;
create trigger app_settings_touch before insert or update on app_settings
  for each row execute function touch_updated_at();
