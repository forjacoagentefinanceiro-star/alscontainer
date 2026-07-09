-- Controle granular de módulos por usuário
-- null = vê tudo que a role permite; array = só os módulos listados
alter table user_profiles
  add column if not exists modulos text[] default null;
