-- Execute no SQL Editor do Supabase (apague as tabelas anteriores se necessário)

-- Tabela de containers
create table if not exists containers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  numero text not null,
  tipo text not null check (tipo in ('nacional','importado')),
  tamanho text not null default '20GP',
  fornecedor text default '',
  data_compra date,
  valor_usd numeric(14,2),
  cotacao numeric(10,4),
  extras_brl numeric(14,2) default 0,
  valor_brl numeric(14,2) default 0,
  obs text default '',
  iso_valido boolean default true,
  created_at timestamptz default now()
);

alter table containers enable row level security;

create policy "user owns containers"
  on containers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Mantém tabelas antigas de sessões/números gerados (gerador)
create table if not exists container_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  owner text not null,
  cat text not null,
  qty int not null,
  new_count int not null default 0,
  dup_count int not null default 0,
  nums jsonb not null default '[]',
  created_at timestamptz default now()
);

create table if not exists used_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  container_key text not null,
  full_number text not null,
  check_digit int not null,
  created_at timestamptz default now(),
  unique(user_id, container_key)
);

alter table container_sessions enable row level security;
alter table used_numbers enable row level security;

create policy "user sees own sessions"
  on container_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user sees own numbers"
  on used_numbers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
--  BI — indicadores agregados vindos do Dashboard BI da
--  eProfessional (websag.../bi), coletados pelo extrator
--  agendado (scripts/extract-websag.ts).
--
--  Dado da EMPRESA (não por usuário): leitura liberada para
--  qualquer usuário logado; escrita só pelo robô (service_role,
--  que bypassa RLS — por isso não há policy de insert/update).
--
--  Formato "long": cada linha é um ponto (série × mês × ano).
-- ============================================================
create table if not exists bi_indicadores (
  id           bigint generated always as identity primary key,
  fonte        text not null default 'websag',
  code         text not null,        -- código do indicador (endpoint)
  titulo       text,
  serie        text not null,        -- label da série (armador / tipo / faixa)
  eixo         text not null,        -- coluna do eixo X (mês)
  ano          integer not null,
  valor        numeric(14,2),
  captured_at  timestamptz not null default now(),
  unique (code, serie, eixo, ano)    -- upsert idempotente
);
create index if not exists idx_bi_ind_code on bi_indicadores (code);
create index if not exists idx_bi_ind_ano  on bi_indicadores (ano);

alter table bi_indicadores enable row level security;

create policy "indicadores: leitura por autenticados"
  on bi_indicadores for select
  using (auth.uid() is not null);
