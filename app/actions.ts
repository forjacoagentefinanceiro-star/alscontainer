'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
}

export async function saveSession(data: {
  owner: string
  cat: string
  qty: number
  new_count: number
  dup_count: number
  nums: { ser: string; cd: number; full: string; dup: boolean }[]
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: session, error } = await supabase
    .from('container_sessions')
    .insert({
      user_id: user.id,
      owner: data.owner,
      cat: data.cat,
      qty: data.qty,
      new_count: data.new_count,
      dup_count: data.dup_count,
      nums: data.nums,
    })
    .select()
    .single()

  if (error) throw error

  // registra os números usados
  const rows = data.nums
    .filter(n => !n.dup)
    .map(n => ({
      user_id: user.id,
      container_key: `${data.owner}${data.cat} ${n.ser}`,
      full_number: n.full,
      check_digit: n.cd,
    }))

  if (rows.length > 0) {
    await supabase.from('used_numbers').insert(rows)
  }

  revalidatePath('/')
  return session
}

export async function deleteSession(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  await supabase
    .from('container_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', user.id)

  revalidatePath('/')
}

export async function clearAllHistory() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  await supabase.from('container_sessions').delete().eq('user_id', user.id)
  await supabase.from('used_numbers').delete().eq('user_id', user.id)

  revalidatePath('/')
}

export async function getUsedKeys(): Promise<Set<string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Set()

  const { data } = await supabase
    .from('used_numbers')
    .select('container_key')
    .eq('user_id', user.id)

  return new Set((data ?? []).map((r: { container_key: string }) => r.container_key))
}
