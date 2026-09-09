-- Rode este script no Supabase: Dashboard > SQL Editor > New query > Run.
--
-- Etapa "login real": cria login de verdade (Supabase Auth, magic link) e
-- controle de quem pode entrar no app e com qual papel (master/executivo).
--
-- Fluxo:
--   1) Master convida alguém pela tela "Usuários" do app -> isso grava uma
--      linha em pending_invites (email + papel + executivo) e dispara o
--      magic link pro e-mail da pessoa.
--   2) A pessoa clica no link, loga, e no primeiro login o app "reivindica"
--      o convite: cria a linha dela em profiles com o papel combinado e
--      apaga o pending_invite.
--   3) Daí em diante, profiles.role decide o que a pessoa ve no app.
--
-- Bootstrap: como ninguem ainda e master, o PRIMEIRO usuario (voce) precisa
-- ser promovido manualmente. Depois de logar pela primeira vez no app (o que
-- cria sua linha em auth.users), rode o bloco "BOOTSTRAP" no final deste
-- arquivo trocando o e-mail.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('master', 'executivo')),
  executive_name text,
  created_at timestamptz not null default now()
);

create table if not exists pending_invites (
  email text primary key,
  role text not null check (role in ('master', 'executivo')),
  executive_name text,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Funcao security definer: verifica se o usuario autenticado atual e master,
-- sem disparar recursao de RLS (bypassa RLS internamente).
create or replace function public.is_master()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'master'
  );
$$;

alter table profiles enable row level security;
alter table pending_invites enable row level security;

drop policy if exists "profiles: self or master select" on profiles;
create policy "profiles: self or master select" on profiles
  for select
  using (id = auth.uid() or public.is_master());

-- Insert so e permitido para o proprio usuario (reivindicar convite /
-- criar seu perfil no primeiro login). Mudar o papel de alguem depois e via
-- update (master only).
drop policy if exists "profiles: self insert" on profiles;
create policy "profiles: self insert" on profiles
  for insert
  with check (id = auth.uid());

drop policy if exists "profiles: master update" on profiles;
create policy "profiles: master update" on profiles
  for update
  using (public.is_master());

drop policy if exists "invites: master or invitee select" on pending_invites;
create policy "invites: master or invitee select" on pending_invites
  for select
  using (public.is_master() or email = auth.jwt() ->> 'email');

drop policy if exists "invites: master insert" on pending_invites;
create policy "invites: master insert" on pending_invites
  for insert
  with check (public.is_master());

drop policy if exists "invites: master or invitee delete" on pending_invites;
create policy "invites: master or invitee delete" on pending_invites
  for delete
  using (public.is_master() or email = auth.jwt() ->> 'email');

-- ---------------------------------------------------------------------------
-- BOOTSTRAP (rode manualmente, uma vez, DEPOIS de logar pela primeira vez
-- pelo app com seu proprio e-mail):
--
-- insert into profiles (id, email, role)
-- select id, email, 'master'
-- from auth.users
-- where email = 'SEU_EMAIL_AQUI'
-- on conflict (id) do update set role = 'master';
-- ---------------------------------------------------------------------------
