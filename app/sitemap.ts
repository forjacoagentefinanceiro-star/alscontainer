import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { ehHostDaLanding, PAGINAS_SITE } from '@/lib/site/host'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  if (!ehHostDaLanding(host)) return []
  return Object.keys(PAGINAS_SITE).map(p => ({ url: `https://${host}${p === '/' ? '' : p}`, changeFrequency: 'weekly' as const, priority: p === '/' ? 1 : 0.8 }))
}
