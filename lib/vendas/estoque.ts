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

/** Containers próprios livres para locação (não locados, vendidos nem à venda) + os já presentes na proposta. Aquisição só p/ admin. */
export async function getProprios(supabase: SB, admin: boolean, extraIds: string[] = []) {
  type Row = { id: string; numero: string; tamanho: string; ano_fabricacao: number | null; status: string | null; para_venda: boolean | null; valor_brl: number | null }
  const cols = 'id, numero, tamanho, ano_fabricacao, status, para_venda, valor_brl'
  const [{ data: livres }, { data: extra }] = await Promise.all([
    supabase.from('containers').select(cols).or('status.is.null,status.eq.disponivel').order('numero').limit(1000),
    extraIds.length ? supabase.from('containers').select(cols).in('id', extraIds) : Promise.resolve({ data: [] as Row[] }),
  ])
  const m = new Map<string, Row>()
  for (const c of [...((livres ?? []) as Row[]).filter(c => !c.para_venda), ...((extra ?? []) as Row[])]) m.set(c.id, c)
  return [...m.values()].map(c => ({ id: c.id, numero: c.numero, tamanho: c.tamanho, ano: c.ano_fabricacao, aquisicao: admin ? Number(c.valor_brl ?? 0) : null }))
}

export const rotuloContainer = (c: Pick<EstoqueItem, 'numero' | 'tamanho' | 'ano_fabricacao'>) =>
  `${c.numero} · ${c.tamanho}${c.ano_fabricacao ? ` · ${c.ano_fabricacao}` : ''}`
