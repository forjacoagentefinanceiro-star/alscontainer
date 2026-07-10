-- Migration: setor nas empilhadeiras + setor e telegram_chat_id nos usuários
-- Execute no SQL Editor do Supabase — uma vez apenas.

-- 1. Setor na tabela de equipamentos
--    Identifica a qual área/setor a máquina pertence (ex: "Pátio A", "Portaria", "Manutenção")
ALTER TABLE empilhadeiras
  ADD COLUMN IF NOT EXISTS setor text;

-- 2. Setor no perfil do usuário
--    Quando preenchido, o usuário vê apenas equipamentos do mesmo setor.
--    null = sem restrição (vê todos).
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS setor text;

-- 3. Telegram Chat ID no perfil do usuário
--    ID do chat pessoal ou grupo Telegram do usuário.
--    O bot usa para enviar alertas referentes às máquinas do setor do usuário.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Índice auxiliar para buscar usuários por setor (usado pelo bot ao enviar alertas)
CREATE INDEX IF NOT EXISTS idx_profiles_setor ON user_profiles (setor)
  WHERE setor IS NOT NULL;
