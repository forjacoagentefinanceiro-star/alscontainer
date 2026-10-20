import { exigirVendas } from '@/lib/vendas/server'
import { getTipos } from '@/lib/vendas/estoque'
import TiposEditor from '@/components/vendas/TiposEditor'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function TiposPage() {
  const { supabase, role } = await exigirVendas()
  const tipos = await getTipos(supabase)
  const { data } = await supabase.from('containers').select('tipo_venda').eq('para_venda', true).not('tipo_venda', 'is', null)
  const usados: Record<string, number> = {}
  for (const c of (data ?? []) as { tipo_venda: string }[]) usados[c.tipo_venda] = (usados[c.tipo_venda] ?? 0) + 1

  return (
    <div>
      <Titulo sub="O preço do container vem do tipo. Ninguém digita preço por unidade.">Tipos e preços</Titulo>
      <Abas ativa="/vendas/tipos" />
      <p className="text-sm text-slate-600 mb-3 max-w-2xl">
        No Inventário, quem marca um container para venda escolhe só o tipo (A, B, C…). O preço do anúncio, dos leads e da venda sai daqui. Mudar o preço de um tipo atualiza os leads em aberto desse tipo.
      </p>
      <TiposEditor tipos={tipos} admin={role === 'admin'} usados={usados} />
    </div>
  )
}
