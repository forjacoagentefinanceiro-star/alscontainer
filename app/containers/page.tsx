import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import Pagina from '@/components/containers/Pagina'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Container 40' High Cube usado em ótimo estado | ALM Containers",
  description: "Container marítimo 40' High Cube usado, em ótimo estado, pronta entrega em Itajaí/SC. Receba o preço e as fotos no WhatsApp.",
  openGraph: {
    title: "Container 40' High Cube usado em ótimo estado | ALM Containers",
    description: 'Pronta entrega em Itajaí/SC. Veja pessoalmente antes de comprar.',
    images: ['/containers/lateral.jpg'],
  },
}

// preço e estoque reais (tipos A/B/C e containers marcados para venda); sem acesso, usa a faixa padrão
async function dados() {
  let min = 10300, max: number | null = 11400, unidades: number | null = null
  try {
    const sb = createAdminClient()
    const { data: t } = await sb.from('cv_tipos').select('preco')
    const precos = (t ?? []).map(x => Number(x.preco)).filter(n => n > 0)
    if (precos.length) { min = Math.min(...precos); max = Math.max(...precos) }
    const { count } = await sb.from('containers').select('id', { count: 'exact', head: true })
      .eq('para_venda', true).or('status.is.null,status.eq.disponivel')
    if (count != null) unidades = count
  } catch { /* sem service role: página segue com valores padrão */ }
  return { min, max, unidades }
}

export default async function ContainersPage() {
  const d = await dados()
  return <Pagina precoMin={d.min} precoMax={d.max} unidades={d.unidades} />
}
