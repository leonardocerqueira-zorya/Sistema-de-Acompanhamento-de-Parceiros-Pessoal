-- Rode este script no Supabase: Dashboard > SQL Editor > New query > Run.
--
-- Passa o escopo por carteira do executivo para DENTRO do banco. Antes, o
-- recorte existia só na interface: qualquer pessoa logada conseguia ler (e
-- gravar) todos os dados chamando a API direto. Agora o banco recusa.
--
-- Regras:
--   * master           -> tudo, em tudo.
--   * executivo        -> só parceiros da carteira dele (partners.account_owner
--                         = profiles.executive_name) e só as indicações desses
--                         parceiros. Ler, criar, editar e apagar, sempre
--                         dentro da carteira.
--   * custo do canal   -> todos leem (os indicadores são visíveis pro time),
--     e novo MRR          só master grava.
--   * planos e tiers   -> todos leem, só master grava.
--   * backup (blob)    -> só master grava. Um executivo gravando ali salvaria
--                         apenas o pedaço que ele vê e destruiria o backup
--                         completo do time.

-- ---------------------------------------------------------------------------
-- Nome do executivo do usuário logado. SECURITY DEFINER para poder ler
-- profiles sem cair na RLS da própria tabela (mesmo motivo do is_master()).
-- ---------------------------------------------------------------------------
create or replace function public.current_executive_name()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select executive_name from public.profiles where id = auth.uid();
$$;

-- Parceiro pertence à carteira de quem está logado?
create or replace function public.owns_partner(p_partner_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1
    from public.partners p
    where p.id = p_partner_id
      and p.account_owner is not null
      and p.account_owner = public.current_executive_name()
  );
$$;

-- ---------------------------------------------------------------------------
-- partners
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated full access" on partners;

drop policy if exists "partners: master or own carteira select" on partners;
create policy "partners: master or own carteira select" on partners
  for select to authenticated
  using (
    public.is_master()
    or (account_owner is not null and account_owner = public.current_executive_name())
  );

drop policy if exists "partners: master or own carteira insert" on partners;
create policy "partners: master or own carteira insert" on partners
  for insert to authenticated
  with check (
    public.is_master()
    or (account_owner is not null and account_owner = public.current_executive_name())
  );

-- O USING controla qual linha pode ser alterada; o WITH CHECK impede que o
-- executivo transfira o parceiro para a carteira de outra pessoa na edição.
drop policy if exists "partners: master or own carteira update" on partners;
create policy "partners: master or own carteira update" on partners
  for update to authenticated
  using (
    public.is_master()
    or (account_owner is not null and account_owner = public.current_executive_name())
  )
  with check (
    public.is_master()
    or (account_owner is not null and account_owner = public.current_executive_name())
  );

drop policy if exists "partners: master or own carteira delete" on partners;
create policy "partners: master or own carteira delete" on partners
  for delete to authenticated
  using (
    public.is_master()
    or (account_owner is not null and account_owner = public.current_executive_name())
  );

-- ---------------------------------------------------------------------------
-- referrals (segue o dono do parceiro indicador)
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated full access" on referrals;

drop policy if exists "referrals: master or own carteira select" on referrals;
create policy "referrals: master or own carteira select" on referrals
  for select to authenticated
  using (public.is_master() or public.owns_partner(partner_id));

drop policy if exists "referrals: master or own carteira insert" on referrals;
create policy "referrals: master or own carteira insert" on referrals
  for insert to authenticated
  with check (public.is_master() or public.owns_partner(partner_id));

drop policy if exists "referrals: master or own carteira update" on referrals;
create policy "referrals: master or own carteira update" on referrals
  for update to authenticated
  using (public.is_master() or public.owns_partner(partner_id))
  with check (public.is_master() or public.owns_partner(partner_id));

drop policy if exists "referrals: master or own carteira delete" on referrals;
create policy "referrals: master or own carteira delete" on referrals
  for delete to authenticated
  using (public.is_master() or public.owns_partner(partner_id));

-- ---------------------------------------------------------------------------
-- channel_costs e new_mrr_entries: todos leem, só master grava.
-- (Os indicadores CAC/CAP/Ticket são visíveis pro time inteiro; o
-- preenchimento do dado do financeiro é exclusivo do master.)
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated full access" on channel_costs;

drop policy if exists "channel_costs: authenticated select" on channel_costs;
create policy "channel_costs: authenticated select" on channel_costs
  for select to authenticated using (true);

drop policy if exists "channel_costs: master write" on channel_costs;
create policy "channel_costs: master write" on channel_costs
  for all to authenticated
  using (public.is_master()) with check (public.is_master());

drop policy if exists "authenticated full access" on new_mrr_entries;

drop policy if exists "new_mrr_entries: authenticated select" on new_mrr_entries;
create policy "new_mrr_entries: authenticated select" on new_mrr_entries
  for select to authenticated using (true);

drop policy if exists "new_mrr_entries: master write" on new_mrr_entries;
create policy "new_mrr_entries: master write" on new_mrr_entries
  for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- ---------------------------------------------------------------------------
-- app_settings: tabela de planos, tiers e marcadores. Todos leem, só master grava.
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated full access" on app_settings;

drop policy if exists "app_settings: authenticated select" on app_settings;
create policy "app_settings: authenticated select" on app_settings
  for select to authenticated using (true);

drop policy if exists "app_settings: master write" on app_settings;
create policy "app_settings: master write" on app_settings
  for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- ---------------------------------------------------------------------------
-- system_backups: virou só backup/exportação (as tabelas são a fonte da
-- verdade). Leitura para quem está logado; gravação apenas master.
-- ---------------------------------------------------------------------------
drop policy if exists "anon full access" on system_backups;
drop policy if exists "anon and authenticated full access" on system_backups;

drop policy if exists "backups: authenticated select" on system_backups;
create policy "backups: authenticated select" on system_backups
  for select to authenticated using (true);

drop policy if exists "backups: master write" on system_backups;
create policy "backups: master write" on system_backups
  for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- ---------------------------------------------------------------------------
-- Marcador de migração concluída.
--
-- O app não pode mais deduzir "preciso migrar" contando linhas: com escopo por
-- carteira, um executivo sem parceiros atribuídos veria zero linhas e o
-- sistema concluiria, errado, que o banco está vazio. Este marcador é a
-- resposta explícita — e é legível por todos.
-- ---------------------------------------------------------------------------
insert into app_settings (key, value)
values ('migration_done', jsonb_build_object('at', now()))
on conflict (key) do nothing;
