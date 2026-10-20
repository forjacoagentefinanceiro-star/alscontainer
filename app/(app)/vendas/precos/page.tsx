import { exigirVendas } from '@/lib/vendas/server'
import type { Preco } from '@/lib/vendas/config'
import PrecosEditor from '@/components/vendas/PrecosEditor'
import { Titulo, Abas } from '@/components/vendas/ui'

export const dynamic = 'force-dynamic'

export default async function PrecosPage() {
  const { supabase } = await exigirVendas()
  const { data } = await supabase.from('cv_precos').select('*').order('ano')
  const precos = (data ?? []) as Preco[]
  const total = precos.reduce((s, p) => s + p.unidades, 0)

  return (
    <div>
      <Titulo sub={`Faixa de preço R$ 10.300 a R$ 11.400 conforme o ano · ${total} unidade(s) disponíveis`}>Preços e estoque</Titulo>
      <Abas ativa="/vendas/precos" />
      <p className="text-sm text-slate-600 mb-3 max-w-2xl">
        Os anos abaixo são exemplos: ajuste para os anos reais das suas unidades. Ao marcar um lead como vendido com o ano preenchido, uma unidade sai do estoque desse ano.
      </p>
      <PrecosEditor precos={precos} />
    </div>
  )
}
