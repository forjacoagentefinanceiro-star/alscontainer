'use client'

import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions'
import { Package2 } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/inventario': 'Inventário',
  '/gerador':    'Gerador ISO',
  '/importar':   'Importar',
  '/exportar':   'Exportar',
}

export function TopBar({ email }: { email: string }) {
  const pathname = usePathname()
  const pageTitle = pageTitles[pathname] ?? 'ALS Depot'

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 shrink-0"
      style={{
        height: 64,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Mobile: logo + título da página */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="rounded-lg overflow-hidden" style={{ background: '#1B4F8A', height: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ALS" style={{ height: 36, width: 'auto', display: 'block' }} />
        </div>
        <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>{pageTitle}</span>
      </div>

      {/* Desktop: ícone + nome do depot */}
      <div className="hidden md:flex items-center gap-2">
        <Package2 size={18} style={{ color: '#1B4F8A' }} />
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>
          Depot Itajaí, SC
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: '#f0f5ff', color: '#1B4F8A', border: '1px solid #dbeafe' }}>
          alslog.com.br
        </span>
      </div>

      {/* Direita: email + botão sair */}
      <div className="flex items-center gap-3">
        <span className="text-xs hidden sm:block truncate max-w-40" style={{ color: '#9ca3af' }}>{email}</span>
        <form action={logout}>
          <button
            type="submit"
            className="text-xs font-semibold rounded px-3 py-1.5 transition-opacity hover:opacity-80"
            style={{ background: '#1B4F8A', color: '#fff' }}
          >
            Sair
          </button>
        </form>
      </div>
    </header>
  )
}
