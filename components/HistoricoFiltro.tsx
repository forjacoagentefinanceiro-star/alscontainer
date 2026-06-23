'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function HistoricoFiltro({ equipamentos }: { equipamentos: string[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const atual = params.get('equipamento') ?? ''

  function onChange(v: string) {
    if (v) router.push(`/historico?equipamento=${encodeURIComponent(v)}`)
    else router.push('/historico')
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Filtrar por máquina:</label>
      <select value={atual} onChange={e => onChange(e.target.value)}
        className="rounded-lg border px-3 py-1.5 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}>
        <option value="">Todas</option>
        {equipamentos.map(e => <option key={e} value={e}>{e}</option>)}
      </select>
      {atual && (
        <button onClick={() => onChange('')} className="text-xs underline" style={{ color: '#1d4ed8' }}>limpar</button>
      )}
    </div>
  )
}
