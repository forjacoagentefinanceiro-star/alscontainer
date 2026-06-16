'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package2, Hash, Upload, FileCode2 } from 'lucide-react'

const items = [
  { href: '/inventario', label: 'Inventário', icon: Package2 },
  { href: '/gerador',    label: 'Gerador',    icon: Hash },
  { href: '/importar',   label: 'Importar',   icon: Upload },
  { href: '/exportar',   label: 'Exportar',   icon: FileCode2 },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-40"
      style={{ background: '#fff', borderColor: '#e5e7eb' }}
    >
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link key={item.href} href={item.href}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors"
            style={{ color: active ? '#1B4F8A' : '#9ca3af' }}>
            <item.icon size={20} />
            <span className="text-[10px]">{item.label}</span>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full" style={{ background: '#1B4F8A' }} />}
          </Link>
        )
      })}
    </nav>
  )
}
