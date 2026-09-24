-- Mapa do Pátio: tamanho '20u' = posição com uma única pilha de 20' (sem lados A/B)
-- Execute no SQL Editor do Supabase
alter table patio_posicoes drop constraint if exists patio_posicoes_tamanho_check;
alter table patio_posicoes add constraint patio_posicoes_tamanho_check check (tamanho in ('20', '40', '20u'));
