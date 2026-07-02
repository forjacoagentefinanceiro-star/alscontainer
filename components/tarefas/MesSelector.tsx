'use client'

import { useRouter } from 'next/navigation'

export function MesSelector({ meses, selecionado }: {
  meses: { key: string; label: string }[]
  selecionado: string
}) {
  const router = useRouter()
  return (
    <select
      value={selecionado}
      onChange={e => router.push(`/tarefas?mes=${e.target.value}`)}
      className="rounded border text-sm px-3 py-1.5 outline-none font-semibold"
      style={{ borderColor: '#d1d5db', color: '#374151', background: '#fff' }}
    >
      <option value="todos">Todos os meses</option>
      {meses.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  )
}
