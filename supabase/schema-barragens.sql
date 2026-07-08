-- Execute no SQL Editor do Supabase

-- Tabela de monitoramento das barragens e nível do rio
-- Uma linha por ponto monitorado (rio, cada barragem)
create table if not exists barragens_monitoramento (
  id          text primary key,          -- ex: 'rio_blumenau', 'barragem_taio'
  nome        text not null,
  valor       text,                       -- valor atual (ex: "7.2")
  unidade     text,                       -- "m", "%", "Mm³"
  status      text,                       -- 'normal','atencao','alerta','emergencia'
  raw_data    text,
  atualizado_em timestamptz default now(),
  changed_em    timestamptz,
  anterior_valor  text,
  anterior_status text
);

-- Sem RLS — acesso apenas via service_role pelo workflow
