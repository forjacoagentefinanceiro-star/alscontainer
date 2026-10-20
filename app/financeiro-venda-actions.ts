'use server'

import { createClient } from '@/lib/supabase/server'
import { updateContainerStatus } from '@/app/actions'

type Payload = Parameters<typeof updateContainerStatus>[1]

/** Mesma troca de status do Financeiro, mas recusa "locado" se o container está marcado para venda. */
export async function atualizarStatusContainer(id: string, payload: Payload) {
  if (payload.status === 'locado') {
    const supabase = await createClient()
    const { data } = await supabase.from('containers').select('para_venda').eq('id', id).maybeSingle()
    if ((data as { para_venda?: boolean } | null)?.para_venda) {
      return { error: 'Container marcado para venda não pode ser locado. Tire da venda no Inventário primeiro.' }
    }
  }
  return updateContainerStatus(id, payload)
}
