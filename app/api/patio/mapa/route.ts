import { getMyProfile } from '@/app/actions'
import { temModulo } from '@/lib/modulos'
import { MAPA_PATIO_HTML } from '@/lib/patio/mapaHtml'

export const dynamic = 'force-dynamic'

export async function GET() {
  const profile = await getMyProfile()
  if (!profile || !temModulo(profile.role, profile.modulos, 'patio')) {
    return new Response('Sem acesso ao Mapa do Pátio', { status: 403 })
  }
  return new Response(MAPA_PATIO_HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  })
}
