'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package2, Hash, Upload, FileCode2, Users } from 'lucide-react'

const baseItems = [
  { href: '/inventario', label: 'Inventário', icon: Package2 },
  { href: '/gerador',    label: 'Gerador',    icon: Hash },
  { href: '/importar',   label: 'Importar',   icon: Upload },
  { href: '/exportar',   label: 'Exportar',   icon: FileCode2 },
]

export function BottomNav({ role }: { role?: string }) {
  const pathname = usePathname()
  const items = role === 'admin'
    ? [...baseItems, { href: '/usuarios', label: 'Usuários', icon: Users }]
    : baseItems
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex"
      style={{
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }}
    >
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative transition-colors"
            style={{ color: active ? '#1B4F8A' : '#9ca3af', minHeight: 56 }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                style={{ width: 32, height: 3, background: '#1B4F8A' }}
              />
            )}
            <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
