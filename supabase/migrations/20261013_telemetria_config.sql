-- Configurações da telemetria (ex.: contorno do terreno do pátio).
-- Execute no SQL Editor do Supabase.

create table if not exists telemetria_config (
  chave          text primary key,              -- ex.: 'limite_patio'
  valor          jsonb not null,                -- ex.: [[lat, lon], [lat, lon], ...]
  atualizado_por uuid references auth.users(id),
  atualizado_em  timestamptz not null default now()
);

alter table telemetria_config enable row level security;

drop policy if exists "telemetria_config le"     on telemetria_config;
drop policy if exists "telemetria_config grava"  on telemetria_config;
drop policy if exists "telemetria_config altera" on telemetria_config;

-- Qualquer usuário aprovado lê
create policy "telemetria_config le" on telemetria_config for select
  using (exists (select 1 from user_profiles where id = auth.uid() and approved = true));

-- Só admin aprovado grava/altera
create policy "telemetria_config grava" on telemetria_config for insert
  with check (exists (select 1 from user_profiles where id = auth.uid() and approved = true and role = 'admin'));

create policy "telemetria_config altera" on telemetria_config for update
  using      (exists (select 1 from user_profiles where id = auth.uid() and approved = true and role = 'admin'))
  with check (exists (select 1 from user_profiles where id = auth.uid() and approved = true and role = 'admin'));
