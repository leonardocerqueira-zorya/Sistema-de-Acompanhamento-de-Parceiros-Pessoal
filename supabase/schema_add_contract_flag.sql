-- Rode este script no Supabase: Dashboard > SQL Editor > New query > Run.
--
-- Adiciona o flag "possui contrato assinado" ao parceiro. NULL = ainda não
-- classificado (import de ontem trouxe só quem tem contrato; o restante entra
-- sem esse campo até o backfill de hoje) — nunca assumir "false" por padrão,
-- senão parceiro pendente de classificação apareceria como "sem contrato".
alter table partners
  add column if not exists has_signed_contract boolean;
