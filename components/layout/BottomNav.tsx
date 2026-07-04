'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { LayoutDashboard, BarChart3, Package2, Hash, Upload, FileCode2, Users, ClipboardCheck, History, Gauge, FolderPlus, ListChecks, CalendarDays } from 'lucide-react'

const baseItems = [
  { href: '/dashboard',    label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/bi',           label: 'BI',         icon: BarChart3 },
  { href: '/inventario',   label: 'Inventário', icon: Package2 },
  { href: '/gerador',      label: 'Gerador',    icon: Hash },
  { href: '/equipamentos', label: 'Painel',     icon: Gauge },
  { href: '/checklist',    label: 'Checklist',  icon: ClipboardCheck },
  { href: '/historico',    label: 'Histórico',  icon: History },
  { href: '/importar',     label: 'Importar',   icon: Upload },
  { href: '/exportar',     label: 'Exportar',   icon: FileCode2 },
]

export function BottomNav({ role }: { role?: string }) {
  const pathname = usePathname()
  const navRef = useRef<HTMLElement>(null)

  const podeCadastrar = role === 'admin' || role === 'editor'
  const items = role === 'operador'
    ? [{ href: '/checklist', label: 'Checklist', icon: ClipboardCheck }]
    : [
        ...baseItems,
        ...(podeCadastrar ? [{ href: '/cadastros', label: 'Cadastros', icon: FolderPlus }] : []),
        ...(role === 'admin' ? [
          { href: '/usuarios', label: 'Usuários', icon: Users },
          { href: '/tarefas', label: 'Indicadores', icon: ListChecks },
          { href: '/tarefas/agenda', label: 'Agenda', icon: CalendarDays },
        ] : []),
      ]

  // Rola para o item ativo ficar centralizado na tela
  useEffect(() => {
    if (!navRef.current) return
    const active = navRef.current.querySelector('[data-active="true"]') as HTMLElement | null
    if (active) {
      active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    }
  }, [pathname])

  return (
    <>
      <style>{`.bottom-nav::-webkit-scrollbar { display: none; }`}</style>
      <nav
        ref={navRef}
        className="bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 flex overflow-x-auto"
        style={{
          background: '#fff',
          borderTop: '1px solid #e5e7eb',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
        }}
      >
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/tarefas' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              data-active={active ? 'true' : undefined}
              className="shrink-0 flex flex-col items-center justify-center gap-1 py-2 relative transition-colors"
              style={{
                color: active ? '#1B4F8A' : '#9ca3af',
                minHeight: 56,
                width: 68,
              }}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                  style={{ width: 32, height: 3, background: '#1B4F8A' }}
                />
              )}
              <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
