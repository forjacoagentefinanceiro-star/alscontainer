-- Migration: coluna telegram_setores em user_profiles
-- Permite que admins escolham quais setores querem receber alertas Telegram.
-- null = recebe de todos os setores; array = só dos setores listados.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS telegram_setores text[];
