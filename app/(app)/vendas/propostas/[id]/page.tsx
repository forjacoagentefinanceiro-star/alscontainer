import Link from 'next/link'
import { notFound } from 'next/navigation'
import { exigirVendas } from '@/lib/vendas/server'
import { getEstoque } from '@/lib/vendas/estoque'
import { getCustos } from '@/lib/vendas/custos'
import type { ItemSalvo } from '../../propostas-actions'
import PropostaForm, { type ItemEstoque, type Linha } from '@/components/vendas/PropostaForm'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function PropostaEditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, role } = await exigirVendas()
  const admin = role === 'admin'
  const { data } = await supabase.from('cv_propostas').select('*').eq('id', id).maybeSingle()
  if (!data) notFound()
  const p = data as {
    id: string; codigo: string; cliente_nome: string; telefone: string | null; email: string | null; documento: string | null
    cidade: string | null; lead_id: string | null; itens: ItemSalvo[]; validade: string; pagamento: string | null
    frete: string | null; observacoes: string | null; ilustrativas: boolean; status: string; criado_em: string
  }

  const { itens: disponiveis } = await getEstoque(supabase)
  const idsProposta = p.itens.map(i => i.container_id).filter((x): x is string => !!x)
  const custos = admin ? await getCustos(supabase, [...new Set([...disponiveis.map(i => i.id), ...idsProposta])]) : {}

  // containers da proposta que já saíram do estoque (vendidos) precisam continuar aparecendo na seleção
  const faltam = idsProposta.filter(cid => !disponiveis.some(d => d.id === cid))
  const { data: extra } = faltam.length
    ? await supabase.from('containers').select('id, numero, tamanho, ano_fabricacao, tipo_venda').in('id', faltam)
    : { data: [] as { id: string; numero: string; tamanho: string; ano_fabricacao: number | null; tipo_venda: string | null }[] }

  const estoque: ItemEstoque[] = [
    ...disponiveis.map(i => ({ id: i.id, numero: i.numero, tamanho: i.tamanho, ano: i.ano_fabricacao, tipo: i.tipo_venda, preco: i.preco_anuncio })),
    ...((extra ?? []) as { id: string; numero: string; tamanho: string; ano_fabricacao: number | null; tipo_venda: string | null }[])
      .map(i => ({ id: i.id, numero: i.numero, tamanho: i.tamanho, ano: i.ano_fabricacao, tipo: i.tipo_venda, preco: null })),
  ].map(i => ({ ...i, custo: admin ? (custos[i.id]?.custo ?? 0) : null, despesas: admin ? (custos[i.id]?.despesas ?? 0) : null }))

  const linhas: Linha[] = p.itens.map((i, n) => ({
    uid: i.container_id ?? `av-${n}`, estoqueId: i.container_id, descricao: i.descricao, detalhe: i.detalhe,
    numero: i.numero, ano: i.ano, qtd: i.qtd, unit: i.unit,
    custo: admin ? (i.container_id ? (custos[i.container_id]?.custo ?? 0) : (i.custo ?? 0)) : null,
    despesas: admin ? (i.container_id ? (custos[i.container_id]?.despesas ?? 0) : 0) : null,
  }))

  return (
    <div>
      <Link href="/vendas/propostas" className="text-sm text-slate-500 hover:underline">← Propostas</Link>
      <Titulo sub={`Criada em ${new Date(p.criado_em).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · situação: ${p.status}`}>
        Proposta {p.codigo}
      </Titulo>
      <Abas ativa="/vendas/propostas" />
      <PropostaForm
        estoque={estoque} verMargem={admin}
        cliente={{ nome: p.cliente_nome, telefone: p.telefone ?? '', email: p.email ?? '', documento: p.documento ?? '', cidade: p.cidade ?? '' }}
        inicial={{
          id: p.id, codigo: p.codigo, criadoEm: p.criado_em, status: p.status, validade: p.validade,
          pagamento: p.pagamento ?? '', frete: p.frete ?? '', obs: p.observacoes ?? '', ilustrativas: p.ilustrativas, leadId: p.lead_id, linhas,
        }}
      />
    </div>
  )
}
