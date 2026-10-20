import type { SB } from './server'
import type { EstoqueItem } from './config'

/** Containers do estoque marcados "para venda" e disponíveis (nem locados nem vendidos) (campo ligado no Inventário). */
export async function getEstoque(supabase: SB): Promise<{ itens: EstoqueItem[]; erro: string | null }> {
  const { data, error } = await supabase
    .from('containers')
    .select('id, numero, tamanho, ano_fabricacao, preco_anuncio, status, obs')
    .eq('para_venda', true)
    .or('status.is.null,status.eq.disponivel')
    .order('ano_fabricacao', { ascending: true })
    .order('numero')
  if (error) return { itens: [], erro: error.message }
  return { itens: (data ?? []) as EstoqueItem[], erro: null }
}

export const rotuloContainer = (c: Pick<EstoqueItem, 'numero' | 'tamanho' | 'ano_fabricacao'>) =>
  `${c.numero} · ${c.tamanho}${c.ano_fabricacao ? ` · ${c.ano_fabricacao}` : ''}`
