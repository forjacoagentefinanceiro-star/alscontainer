'use client'

import { useState } from 'react'
import type { Container } from '@/app/actions'
import { InventarioTab } from './tabs/InventarioTab'
import { ExportTab } from './tabs/ExportTab'
import { ImportTab } from './tabs/ImportTab'
import { GeradorTab } from './tabs/GeradorTab'

type Tab = 'inventario' | 'gerador' | 'importar' | 'exportar'

type Session = {
  id: string
  owner: string
  cat: string
  qty: number
  new_count: number
  dup_count: number
  nums: { ser: string; cd: number; full: string; dup: boolean }[]
  created_at: string
}

export function DepotApp({ initialContainers, initialSessions, initialUsedKeys }: {
  initialContainers: Container[]
  initialSessions: Session[]
  initialUsedKeys: string[]
}) {
  const [tab, setTab] = useState<Tab>('inventario')
  const [containers] = useState(initialContainers)

  const tabs: { id: Tab; label: string }[] = [
    { id: 'inventario', label: '▪ Inventário' },
    { id: 'exportar', label: '</> Exportar XML' },
    { id: 'importar', label: '⬆ Importar' },
    { id: 'gerador', label: '# Gerador ISO' },
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 text-sm font-medium rounded transition-all"
            style={{
              background: tab === t.id ? '#1B4F8A' : '#ffffff',
              color: tab === t.id ? '#ffffff' : '#374151',
              border: `1px solid ${tab === t.id ? '#1B4F8A' : '#d1d5db'}`,
              boxShadow: tab === t.id ? '0 1px 3px rgba(27,79,138,0.3)' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inventario' && <InventarioTab initialContainers={containers} />}
      {tab === 'gerador' && <GeradorTab initialSessions={initialSessions} initialUsedKeys={initialUsedKeys} />}
      {tab === 'importar' && <ImportTab onImported={() => setTab('inventario')} />}
      {tab === 'exportar' && <ExportTab containers={containers} />}
    </div>
  )
}
