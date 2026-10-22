import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Pagina from '@/components/containers/Pagina'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  return {
    metadataBase: new URL(`${proto}://${host}`),
    icons: {
      icon: [{ url: '/containers/alm-favicon.ico', sizes: 'any' }, { url: '/containers/alm-favicon.png', type: 'image/png', sizes: '512x512' }],
      shortcut: '/containers/alm-favicon.ico',
      apple: '/containers/alm-apple-touch.png',
    },
    title: "Container 40' High Cube usado em ótimo estado | ALM Containers",
    description: "Container marítimo 40' High Cube usado, em ótimo estado, pronta entrega em Itajaí/SC. Receba o preço e as fotos no WhatsApp.",
    openGraph: {
      title: "Container 40' High Cube usado em ótimo estado | ALM Containers",
      description: 'Pronta entrega em Itajaí/SC. Agende uma visita e veja pessoalmente antes de comprar.',
      images: ['/containers/alm-banner.jpg'],
    },
  }
}

// Preço de entrada fixo da campanha: "a partir de R$ 8.500,00" (sem teto). A página não mostra quantidade de unidades.
const PRECO_INICIAL = 8500

export default function ContainersPage() {
  return <Pagina precoMin={PRECO_INICIAL} />
}
