import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import { headers } from 'next/headers'
import './site.css'
import { Pixels } from '@/components/site/Pecas'
import { Progresso, Rodape, WhatsFlutuante } from '@/components/site/Interativos'
import { MARCA } from '@/lib/site/dados'

const titulo = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], style: ['normal', 'italic'], variable: '--font-titulo', display: 'swap' })
const corpo = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-corpo', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: { default: 'MLA Containers — venda e locação de containers em Itajaí/SC', template: '%s | MLA Containers' },
    description: 'Containers marítimos 40 pés High Cube usados, em ótimo estado, para venda e locação em Itajaí/SC. Fotos reais, visita agendada no pátio e atendimento direto pelo WhatsApp.',
    icons: {
      icon: [{ url: '/containers/mla-favicon.ico', sizes: 'any' }, { url: '/containers/mla-favicon.png', type: 'image/png', sizes: '512x512' }],
      shortcut: '/containers/mla-favicon.ico', apple: '/containers/mla-apple-touch.png',
    },
    openGraph: { type: 'website', siteName: MARCA, locale: 'pt_BR', images: ['/containers/mla-banner.jpg'] },
  }
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: MARCA,
    description: 'Venda e locação de containers em Itajaí/SC.', telephone: '+55 47 98917-3801', image: '/containers/mla-banner.jpg',
    address: { '@type': 'PostalAddress', streetAddress: 'Av. Gov. Adolfo Konder, 2600', addressLocality: 'Itajaí', addressRegion: 'SC', postalCode: '88308-000', addressCountry: 'BR' },
  }
  return (
    <div className={`mla ${titulo.variable} ${corpo.variable}`}>
      <Pixels />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <Progresso />
      {children}
      <Rodape />
      <WhatsFlutuante />
    </div>
  )
}
