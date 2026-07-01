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
  ClipboardCheck,
  History,
  Gauge,
  LineChart,
  FileText,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  ListChecks,
} from 'lucide-react'

type Item = { href: string; label: string; icon: typeof LayoutDashboard }
type Section = { label: string; items: Item[] }

const estoqueItems: Item[] = [
  { href: '/dashboard',  label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/inventario', label: 'Inventário',  icon: Package2        },
  { href: '/gerador',    label: 'Gerador ISO', icon: Hash            },
  { href: '/importar',   label: 'Importar',    icon: Upload          },
  { href: '/exportar',   label: 'Exportar',    icon: FileCode2       },
]

const checklistItem: Item = { href: '/checklist', label: 'Checklist', icon: ClipboardCheck }
const equipamentosItems: Item[] = [
  { href: '/equipamentos', label: 'Painel',       icon: Gauge          },
  checklistItem,
  { href: '/historico',    label: 'Histórico',    icon: History        },
  { href: '/equipamentos/indicadores', label: 'Indicadores', icon: LineChart },
  { href: '/equipamentos/relatorios',  label: 'Relatórios',  icon: FileText },
]

const cadastrosItem: Item = { href: '/cadastros', label: 'Cadastros', icon: FolderPlus }
const usuariosItem: Item = { href: '/usuarios', label: 'Usuários', icon: Users }
const tarefasItem: Item = { href: '/tarefas', label: 'Tarefas', icon: ListChecks }
const biItems: Item[] = [{ href: '/bi', label: 'BI Depot', icon: BarChart3 }]

function NavLink({ item, active, collapsed }: { item: Item; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative"
      style={{
        background: active ? 'rgba(125,194,66,0.1)' : 'transparent',
        color: active ? '#7DC242' : '#4a6a8a',
      }}
      onMouseEnter={e => {
        if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#8ca5c8' }
      }}
      onMouseLeave={e => {
        if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4a6a8a' }
      }}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{ width: 3, height: 20, background: '#7DC242' }} />
      )}
      <item.icon size={17} className="shrink-0" style={{ color: active ? '#7DC242' : 'inherit' }} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

function SectionLabel({ children, collapsed, first }: { children: string; collapsed: boolean; first?: boolean }) {
  if (collapsed) {
    if (first) return null
    return <div className="mx-3 my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
  }
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#3a5578' }}>
      {children}
    </p>
  )
}

export function Sidebar({ role }: { role?: string }) {
  const isOperador = role === 'operador'
  const podeCadastrar = role === 'admin' || role === 'editor'
  const sections: Section[] = isOperador
    ? [{ label: 'Equipamentos', items: [checklistItem] }]
    : [
        { label: 'Estoque', items: estoqueItems },
        { label: 'Equipamentos', items: equipamentosItems },
        ...(podeCadastrar ? [{ label: 'Cadastros', items: [cadastrosItem] }] : []),
        ...(role === 'admin' ? [{ label: 'Configurações', items: [usuariosItem, tarefasItem] }] : []),
        { label: 'Análise', items: biItems },
      ]
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside
      className="hidden md:flex relative flex-col h-full shrink-0 transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? 72 : 240, background: '#0d1b2e', borderRight: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Logo */}
      <div style={{ background: '#1B4F8A', minHeight: 72, display: 'flex', alignItems: 'center', position: 'relative' }}>
        {collapsed ? (
          <div className="flex justify-center w-full py-3 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALS" style={{ height: 38, width: 'auto', objectFit: 'cover', objectPosition: 'left center' }} />
          </div>
        ) : (
          <div className="flex items-center justify-between w-full pr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ALS Logística" style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
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
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {sections.map((sec, i) => (
          <div key={sec.label}>
            <SectionLabel collapsed={collapsed} first={i === 0}>{sec.label}</SectionLabel>
            <div className="space-y-0.5">
              {sec.items.map(item => <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />)}
            </div>
          </div>
        ))}
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
