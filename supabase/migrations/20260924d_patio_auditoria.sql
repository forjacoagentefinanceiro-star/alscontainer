-- Mapa do Pátio: auditoria com estado antes/depois de cada alteração
-- Execute no SQL Editor do Supabase
alter table patio_historico
  add column if not exists antes  jsonb,   -- como a posição estava (null = dados do levantamento ou pilha nova)
  add column if not exists depois jsonb;   -- como ficou (null quando removida)
create index if not exists patio_historico_criado_idx on patio_historico (criado_em desc);
