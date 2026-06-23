'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const OPCOES = [
  { v: '7', label: 'Últimos 7 dias' },
  { v: '30', label: 'Últimos 30 dias' },
  { v: '90', label: 'Últimos 90 dias' },
  { v: '0', label: 'Tudo' },
]

export function IndicadoresFiltro() {
  const router = useRouter()
  const params = useSearchParams()
  const atual = params.get('dias') ?? '30'

  return (
    <div className="flex items-center gap-2 mb-4">
      <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Período:</label>
      <select value={atual} onChange={e => router.push(`/equipamentos/indicadores?dias=${e.target.value}`)}
        className="rounded-lg border px-3 py-1.5 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}>
        {OPCOES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  )
}
