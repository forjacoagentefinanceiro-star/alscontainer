-- Migration: adiciona data_ref (data de captura) à bi_indicadores
-- para permitir comparação "hoje vs mesmo dia do mês passado"
--
-- Execute no SQL Editor do Supabase — uma vez apenas.
-- Após executar, os extratores passam a inserir um snapshot por dia
-- (upsert on conflict code,serie,eixo,ano,data_ref).

-- 1. Adiciona coluna — linhas existentes recebem a data de hoje (data da migração)
ALTER TABLE bi_indicadores
  ADD COLUMN IF NOT EXISTS data_ref date NOT NULL DEFAULT CURRENT_DATE;

-- 2. Remove constraint única antiga
ALTER TABLE bi_indicadores
  DROP CONSTRAINT IF EXISTS bi_indicadores_code_serie_eixo_ano_key;

-- 3. Nova constraint: mesma série + mês + data de captura é única
--    → execuções no mesmo dia sobrescrevem (idempotente), cada dia novo cria linha
ALTER TABLE bi_indicadores
  ADD CONSTRAINT bi_indicadores_code_serie_eixo_ano_data_ref_key
  UNIQUE (code, serie, eixo, ano, data_ref);

-- 4. Índice auxiliar para queries de comparação por data
CREATE INDEX IF NOT EXISTS idx_bi_ind_data_ref ON bi_indicadores (data_ref);
