'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/** Marca/desmarca um container do estoque como "para venda" (aparece no CRM de vendas). */
export async function marcarParaVenda(id: string, paraVenda: boolean, tipo: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const { data: p } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  const role = (p as { role?: string } | null)?.role
  if (role !== 'admin' && role !== 'editor') return { error: 'Sem permissão para alterar o estoque.' }

  if (paraVenda) {
    if (!tipo) return { error: 'Escolha o tipo do container (A, B ou C).' }
    const { data: t } = await supabase.from('cv_tipos').select('codigo').eq('codigo', tipo).maybeSingle()
    if (!t) return { error: 'Tipo inexistente. O administrador cadastra os tipos em Vendas > Tipos e preços.' }
  }
  if (paraVenda) {
    const { data: atual } = await supabase.from('containers').select('status').eq('id', id).maybeSingle()
    if (atual?.status === 'locado') return { error: 'Container locado não pode ser marcado para venda.' }
  }
  const { data, error } = await supabase
    .from('containers')
    .update({ para_venda: paraVenda, tipo_venda: paraVenda ? tipo : null })
    .eq('id', id)
    .select('id')
  if (error) {
    return { error: /para_venda|tipo_venda|cv_tipos/.test(error.message) ? 'Rode crm_vendas_estoque.sql e crm_vendas_tipos.sql no Supabase antes.' : error.message }
  }
  if (!data?.length) return { error: 'Não foi possível alterar este container.' }
  revalidatePath('/inventario')
  revalidatePath('/vendas', 'layout')
  return { error: null }
}
