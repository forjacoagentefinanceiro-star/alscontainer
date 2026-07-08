-- Execute no SQL Editor do Supabase

create table if not exists barragens_monitoramento (
  id                 text primary key,  -- 'barr_oeste_taio', 'barr_sul_ituporanga', 'rio_blumenau'
  nome               text not null,
  tipo               text,              -- 'barragem' | 'rio'
  nivel_m            text,              -- nível em metros
  capacidade_pct     text,              -- % de capacidade (barragens)
  comportas_abertas  text,
  comportas_fechadas text,
  hora_leitura       text,
  status             text,              -- 'normal','atencao','alerta','emergencia'
  atualizado_em      timestamptz default now(),
  changed_em         timestamptz,
  anterior_nivel_m   text,
  anterior_status    text
);

-- Sem RLS — acesso exclusivo via service_role do workflow
