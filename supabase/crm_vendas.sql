-- CRM de vendas de containers usados (módulo "vendas")
-- Rodar UMA vez no SQL Editor do Supabase. Idempotente.

-- Quem pode usar: admin, ou usuário com o módulo 'vendas' liberado em /usuarios
create or replace function cv_pode() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_profiles p
    where p.id = auth.uid()
      and (p.role = 'admin' or 'vendas' = any(coalesce(p.modulos, '{}')))
  );
$$;

create table if not exists cv_campanhas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  canal       text not null,
  inicio      date,
  fim         date,
  verba       numeric(12,2) not null default 0,   -- gasto real em R$
  link        text,
  utm         text,
  ativa       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table if not exists cv_leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  telefone      text,
  cidade        text,
  canal         text not null default 'whatsapp',
  campanha_id   uuid references cv_campanhas(id) on delete set null,
  uso           text,
  ano_pref      int,
  preco         numeric(12,2),                    -- valor negociado
  etapa         text not null default 'novo',
  motivo_perda  text,
  responsavel   text,
  obs           text,
  criado_por    uuid references auth.users(id) default auth.uid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primeira_resposta_em timestamptz,
  fechado_em    timestamptz,
  constraint cv_leads_etapa_chk check (etapa in
    ('novo','conversa','visita','proposta','sinal','vendido','perdido'))
);
create index if not exists cv_leads_etapa_idx on cv_leads(etapa);
create index if not exists cv_leads_canal_idx on cv_leads(canal);
create index if not exists cv_leads_campanha_idx on cv_leads(campanha_id);

create table if not exists cv_atividades (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references cv_leads(id) on delete cascade,
  tipo       text not null default 'nota',        -- nota | whatsapp | etapa | ligacao | visita
  texto      text not null,
  criado_por uuid references auth.users(id) default auth.uid(),
  criado_em  timestamptz not null default now()
);
create index if not exists cv_atividades_lead_idx on cv_atividades(lead_id, criado_em desc);

create table if not exists cv_tarefas (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references cv_leads(id) on delete cascade,
  titulo        text not null,
  vence_em      timestamptz not null,
  concluida_em  timestamptz,
  criado_em     timestamptz not null default now()
);
create index if not exists cv_tarefas_abertas_idx on cv_tarefas(vence_em) where concluida_em is null;

-- Tabela de preços por ano de fabricação do container
create table if not exists cv_precos (
  ano       int primary key,
  preco     numeric(12,2) not null,
  unidades  int not null default 0,               -- unidades disponíveis desse ano
  vendidas  int not null default 0
);

-- Preço de referência (10.300 a 11.400 conforme o ano) — ajuste na tela Preços
insert into cv_precos (ano, preco, unidades) values
  (2016, 10300, 0), (2018, 10800, 0), (2020, 11400, 0)
on conflict (ano) do nothing;

-- RLS
do $$
declare t text;
begin
  foreach t in array array['cv_campanhas','cv_leads','cv_atividades','cv_tarefas','cv_precos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_acesso', t);
    execute format('create policy %I on %I for all to authenticated using (cv_pode()) with check (cv_pode())', t || '_acesso', t);
  end loop;
end $$;
