import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { temModulo } from '@/lib/modulos'

/** Garante login + módulo "vendas" liberado. Devolve o client do Supabase. */
export async function exigirVendas() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await supabase.from('user_profiles').select('role, modulos').eq('id', user.id).single()
  const role = (p as { role?: string } | null)?.role
  const modulos = (p as { modulos?: string[] | null } | null)?.modulos ?? null
  if (!temModulo(role, modulos, 'vendas')) redirect('/inventario')
  return { supabase, user, role }
}

export type SB = Awaited<ReturnType<typeof exigirVendas>>['supabase']
