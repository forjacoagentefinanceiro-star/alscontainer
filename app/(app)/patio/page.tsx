import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getMyProfile } from '@/app/actions'
import { temModulo } from '@/lib/modulos'

export const dynamic = 'force-dynamic'

export default async function PatioPage() {
  const profile = await getMyProfile()
  if (!profile || !temModulo(profile.role, profile.modulos, 'patio')) redirect('/inventario')

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Mapa do Pátio</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
            Posições por rua, armador e situação · qual oficina usar para cada armador
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
        {profile.role === 'admin' && (
          <Link
            href="/patio/historico"
            style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: '#1B4F8A', padding: '7px 14px', borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Histórico de alterações
          </Link>
        )}
        <Link
          href="/api/patio/mapa"
          target="_blank"
          style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2e', background: '#7DC242', padding: '7px 14px', borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          Tela cheia ↗
        </Link>
        </div>
      </div>
      <iframe
        src="/api/patio/mapa"
        title="Mapa do Pátio"
        className="w-full block rounded-xl"
        style={{ height: 'calc(100dvh - 200px)', minHeight: 520, border: '1px solid #1f2a33', background: '#0f1316' }}
      />
    </div>
  )
}
