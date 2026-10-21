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
    images: ['/containers/alm-banner.jpg'],
  },
}

// Preço de entrada fixo da campanha: "a partir de R$ 10.300,00" (sem teto). Estoque real = containers marcados para venda.
const PRECO_INICIAL = 10300

async function unidadesDisponiveis(): Promise<number | null> {
  try {
    const sb = createAdminClient()
    const { count } = await sb.from('containers').select('id', { count: 'exact', head: true })
      .eq('para_venda', true).or('status.is.null,status.eq.disponivel')
    return count ?? null
  } catch { return null }   // sem service role: a página segue sem o contador
}

export default async function ContainersPage() {
  return <Pagina precoMin={PRECO_INICIAL} unidades={await unidadesDisponiveis()} />
}
