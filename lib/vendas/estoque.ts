import type { SB } from './server'
import type { EstoqueItem, Tipo } from './config'

export async function getTipos(supabase: SB): Promise<Tipo[]> {
  const { data } = await supabase.from('cv_tipos').select('*').order('ordem')
  return ((data ?? []) as Tipo[]).map(t => ({ ...t, preco: Number(t.preco) }))
}

/** Containers do estoque marcados "para venda" e disponíveis (nem locados nem vendidos). O preço vem do tipo A/B/C. */
export async function getEstoque(supabase: SB): Promise<{ itens: EstoqueItem[]; erro: string | null }> {
  const { data, error } = await supabase
    .from('containers')
    .select('id, numero, tamanho, ano_fabricacao, tipo_venda, status, obs')
    .eq('para_venda', true)
    .or('status.is.null,status.eq.disponivel')
    .order('ano_fabricacao', { ascending: true })
    .order('numero')
  if (error) return { itens: [], erro: error.message }
  const preco = Object.fromEntries((await getTipos(supabase)).map(t => [t.codigo, t.preco]))
  const itens = ((data ?? []) as Omit<EstoqueItem, 'preco_anuncio'>[]).map(c => ({
    ...c, preco_anuncio: c.tipo_venda ? preco[c.tipo_venda] ?? null : null,
  }))
  return { itens, erro: null }
}

export const rotuloContainer = (c: Pick<EstoqueItem, 'numero' | 'tamanho' | 'ano_fabricacao'>) =>
  `${c.numero} · ${c.tamanho}${c.ano_fabricacao ? ` · ${c.ano_fabricacao}` : ''}`
