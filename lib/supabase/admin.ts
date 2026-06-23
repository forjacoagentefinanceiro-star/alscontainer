import { createClient } from '@supabase/supabase-js'

// Cliente com service_role — SOMENTE no servidor (server actions). Nunca expor no navegador.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Domínio "fake" para operadores que não têm e-mail. O operador loga só com o usuário.
export const OPERADOR_DOMINIO = 'als.local'
