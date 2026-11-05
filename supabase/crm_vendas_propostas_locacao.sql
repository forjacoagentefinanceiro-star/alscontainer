-- Propostas de LOCAÇÃO no mesmo cadastro das propostas de venda. Idempotente.
alter table cv_propostas add column if not exists tipo   text    not null default 'venda';   -- venda | locacao
alter table cv_propostas add column if not exists dias   integer;                              -- prazo da locação (dias)
alter table cv_propostas add column if not exists extras jsonb   not null default '{}';        -- início, frete/taxa cobrados, custos (frete pago, impostos, comissão…)

alter table cv_propostas drop constraint if exists cv_propostas_tipo_chk;
alter table cv_propostas add constraint cv_propostas_tipo_chk check (tipo in ('venda','locacao'));
create index if not exists cv_propostas_tipo_idx on cv_propostas(tipo);

-- PV-AAAA-NNNN (venda) · PL-AAAA-NNNN (locação)
create or replace function cv_propostas_codigo() returns trigger language plpgsql as $$
begin
  if new.codigo is null then
    new.codigo := case when new.tipo = 'locacao' then 'PL-' else 'PV-' end
      || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '-' || lpad(new.seq::text, 4, '0');
  end if;
  return new;
end $$;
