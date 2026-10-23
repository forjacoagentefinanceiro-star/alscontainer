import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { ehHostDaLanding } from '@/lib/site/host'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  // sistema interno: nada indexado; site público: tudo liberado, menos a landing de anúncios e a API
  if (!ehHostDaLanding(host)) return { rules: { userAgent: '*', disallow: '/' } }
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/containers'] }, sitemap: `https://${host}/sitemap.xml` }
}
