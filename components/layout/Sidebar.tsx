'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard,
  BarChart3,
  Package2,
  Hash,
  Upload,
  FileCode2,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

const baseItems = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/bi',         label: 'BI',          icon: BarChart3       },
  { href: '/inventario', label: 'Inventário',  icon: Package2        },
  { href: '/gerador',    label: 'Gerador ISO', icon: Hash            },
  { href: '/importar',   label: 'Importar',    icon: Upload          },
  { href: '/exportar',   label: 'Exportar',    icon: FileCode2       },
]

export function Sidebar({ role }: { role?: string }) {
  const navItems = role === 'admin'
    ? [...baseItems, { href: '/usuarios', label: 'Usuários', icon: Users }]
    : baseItems
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className="hidden md:flex relative flex-col h-full shrink-0 transition-all duration-300 ease-in-out"
      style={{
        width: collapsed ? 72 : 240,
        background: '#0d1b2e',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo — fundo #1B4F8A igual ao do PNG para encaixe perfeito */}
      <div style={{ background: '#1B4F8A', minHeight: 72, display: 'flex', alignItems: 'center', position: 'relative' }}>
        {collapsed ? (
          <div className="flex justify-center w-full py-3 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALS"
              style={{ height: 38, width: 'auto', objectFit: 'cover', objectPosition: 'left center' }} />
          </div>
        ) : (
          <div className="flex items-center justify-between w-full pr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALS Logística"
              style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
            <button
              onClick={() => setCollapsed(true)}
              className="p-1.5 rounded-lg transition-colors flex-shrink-0"
              style={{ color: 'rgba(255,255,255,0.5)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Botão reabrir */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="mx-auto mt-3 p-2 rounded-lg transition-colors"
          style={{ color: '#4a6a8a' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#8ca5c8' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4a6a8a' }}
        >
          <PanelLeftOpen size={15} />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative"
              style={{
                background: active ? 'rgba(125,194,66,0.1)' : 'transparent',
                color: active ? '#7DC242' : '#4a6a8a',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                  e.currentTarget.style.color = '#8ca5c8'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#4a6a8a'
                }
              }}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                  style={{ width: 3, height: 20, background: '#7DC242' }} />
              )}
              <item.icon
                size={17}
                className="shrink-0"
                style={{ color: active ? '#7DC242' : 'inherit' }}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé */}
      {!collapsed && (
        <div className="px-4 pb-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#1e3560' }}>
            ALS Depot · v1.0
          </p>
        </div>
      )}
    </aside>
  )
}
