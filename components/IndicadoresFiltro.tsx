'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function mesAtualBrasilia(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
}

function gerarMeses(n: number): { value: string; label: string }[] {
  const result = []
  const atual = mesAtualBrasilia()
  let [y, m] = atual.split('-').map(Number)
  for (let i = 0; i < n; i++) {
    const value = `${y}-${String(m).padStart(2, '0')}`
    result.push({ value, label: `${NOMES_MES[m - 1]} ${y}` })
    m--
    if (m === 0) { m = 12; y-- }
  }
  return result
}

const MESES = gerarMeses(12)

export function IndicadoresFiltro({ basePath = '/equipamentos/indicadores' }: { basePath?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const atual = params.get('mes') ?? mesAtualBrasilia()

  return (
    <div className="flex items-center gap-2 mb-4">
      <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Período:</label>
      <select value={atual} onChange={e => router.push(`${basePath}?mes=${e.target.value}`)}
        className="rounded-lg border px-3 py-1.5 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}>
        {MESES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
