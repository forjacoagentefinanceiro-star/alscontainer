import type { SB } from './server'

/** Custo de aquisição (valor_brl) e despesas lançadas por container. Só chamar para admin. */
export async function getCustos(supabase: SB, ids: string[]): Promise<Record<string, { custo: number; despesas: number }>> {
  const out: Record<string, { custo: number; despesas: number }> = {}
  if (!ids.length) return out
  const [{ data }, { data: lanc }] = await Promise.all([
    supabase.from('containers').select('id, valor_brl').in('id', ids),
    supabase.from('container_lancamentos').select('container_id, valor').eq('tipo', 'despesa').in('container_id', ids),
  ])
  for (const c of (data ?? []) as { id: string; valor_brl: number | null }[]) out[c.id] = { custo: Number(c.valor_brl ?? 0), despesas: 0 }
  for (const l of (lanc ?? []) as { container_id: string; valor: number }[]) {
    (out[l.container_id] ??= { custo: 0, despesas: 0 }).despesas += Number(l.valor)
  }
  return out
}

/** Lucro líquido de uma lista de itens de proposta (custo = aquisição + despesas; avulso usa item.custo). */
export function lucroDaProposta(
  itens: { container_id: string | null; qtd: number; unit: number; custo?: number | null }[],
  custos: Record<string, { custo: number; despesas: number }>,
) {
  let venda = 0, custo = 0
  for (const i of itens) {
    venda += i.qtd * i.unit
    const c = i.container_id ? (custos[i.container_id]?.custo ?? 0) + (custos[i.container_id]?.despesas ?? 0) : (i.custo ?? 0)
    custo += i.qtd * c
  }
  const lucro = venda - custo
  return { venda, custo, lucro, margem: venda > 0 ? (lucro / venda) * 100 : 0 }
}
