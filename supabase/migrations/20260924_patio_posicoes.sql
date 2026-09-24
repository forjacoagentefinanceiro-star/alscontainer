-- Mapa do Pátio: estado atual de cada posição + histórico de alterações
-- Execute no SQL Editor do Supabase

create table if not exists patio_posicoes (
  chave          text primary key,             -- 'R1 E|E12' (rua/lado do mapa | posição)
  armador        text not null,                -- maersk, hapag, evergreen, login, one, valle, cheio, livre, oficina
  situacao       text not null,                -- AV, OK, SOF (ok reparado), SAINDO, VENDA, DESCARGA, CHEIO, VAZIO, OFICINA, LIVRE, NA
  pilha          text check (pilha in ('completa','parcial','vazia')),
  qtd            integer check (qtd is null or qtd >= 0),
  obs            text,
  atualizado_por uuid references auth.users(id),
  atualizado_email text,
  atualizado_em  timestamptz not null default now()
);

create table if not exists patio_historico (
  id             bigint generated always as identity primary key,
  chave          text not null,
  armador        text,
  situacao       text,
  pilha          text,
  qtd            integer,
  obs            text,
  usuario        uuid references auth.users(id),
  usuario_email  text,
  criado_em      timestamptz not null default now()
);
create index if not exists patio_historico_chave_idx on patio_historico (chave, criado_em desc);

-- Acesso: admin aprovado, ou usuário aprovado com o módulo 'patio' liberado
create or replace function public.tem_modulo_patio() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and approved = true
      and (role = 'admin' or 'patio' = any(coalesce(modulos, '{}')))
  )
$$;

alter table patio_posicoes  enable row level security;
alter table patio_historico enable row level security;

drop policy if exists "patio le posicoes"      on patio_posicoes;
drop policy if exists "patio grava posicoes"   on patio_posicoes;
drop policy if exists "patio altera posicoes"  on patio_posicoes;
drop policy if exists "patio le historico"     on patio_historico;
drop policy if exists "patio grava historico"  on patio_historico;

create policy "patio le posicoes"     on patio_posicoes  for select using (public.tem_modulo_patio());
create policy "patio grava posicoes"  on patio_posicoes  for insert with check (public.tem_modulo_patio());
create policy "patio altera posicoes" on patio_posicoes  for update using (public.tem_modulo_patio()) with check (public.tem_modulo_patio());
create policy "patio le historico"    on patio_historico for select using (public.tem_modulo_patio());
create policy "patio grava historico" on patio_historico for insert with check (public.tem_modulo_patio());
