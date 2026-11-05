-- Propostas de venda registradas (número próprio, pesquisa e conversão em venda). Idempotente.
create sequence if not exists cv_propostas_seq;

create table if not exists cv_propostas (
  id            uuid primary key default gen_random_uuid(),
  seq           bigint not null default nextval('cv_propostas_seq'),
  codigo        text unique,                       -- PV-2026-0001 (gerado por trigger)
  cliente_nome  text not null,
  telefone      text,
  email         text,
  documento     text,
  cidade        text,
  lead_id       uuid references cv_leads(id) on delete set null,
  itens         jsonb not null default '[]',       -- [{container_id, numero, ano, descricao, detalhe, qtd, unit}]
  total         numeric(14,2) not null default 0,
  validade      date not null,
  pagamento     text,
  frete         text,
  observacoes   text,
  ilustrativas  boolean not null default true,
  status        text not null default 'aberta',    -- aberta | vendida | perdida
  vendida_em    timestamptz,
  criado_por    uuid references auth.users(id) default auth.uid(),
  criado_em     timestamptz not null default now(),
  constraint cv_propostas_status_chk check (status in ('aberta','vendida','perdida'))
);
create index if not exists cv_propostas_status_idx on cv_propostas(status);
create index if not exists cv_propostas_cliente_idx on cv_propostas(lower(cliente_nome));

create or replace function cv_propostas_codigo() returns trigger language plpgsql as $$
begin
  if new.codigo is null then
    new.codigo := 'PV-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-' || lpad(new.seq::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists cv_propostas_codigo_trg on cv_propostas;
create trigger cv_propostas_codigo_trg before insert on cv_propostas for each row execute function cv_propostas_codigo();

alter table cv_propostas enable row level security;
drop policy if exists cv_propostas_acesso on cv_propostas;
create policy cv_propostas_acesso on cv_propostas for all to authenticated using (cv_pode()) with check (cv_pode());
