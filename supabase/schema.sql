-- Rode este script no Supabase: Dashboard > SQL Editor > New query > Run.
--
-- Passo 1 da migração (ver memória "persistence-and-roles-decision"): espelhar o
-- mesmo formato do backup local (SystemBackup / exportAllData()) num único registro
-- na nuvem. Sem RLS/autenticação real ainda -- é só um espelho de segurança e o
-- ponto de partida para, depois, virar tabelas relacionais (partners/referrals)
-- com RLS por executivo quando o multiusuário for necessário.

create table if not exists system_backups (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table system_backups enable row level security;

-- Politica temporaria: permite leitura/escrita com a anon key (app ainda sem login).
-- Revisar/restringir quando a autenticação de usuarios for implementada.
drop policy if exists "anon full access" on system_backups;
create policy "anon full access" on system_backups
  for all
  to anon
  using (true)
  with check (true);
