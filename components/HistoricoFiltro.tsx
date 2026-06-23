'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export function HistoricoFiltro({ equipamentos }: { equipamentos: string[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const equipamentoAtual = params.get('equipamento') ?? ''
  const comProblema = params.get('problema') === '1'

  function aplicar(next: { equipamento?: string; problema?: boolean }) {
    const p = new URLSearchParams(params.toString())
    const equip = next.equipamento !== undefined ? next.equipamento : equipamentoAtual
    const prob = next.problema !== undefined ? next.problema : comProblema
    if (equip) p.set('equipamento', equip); else p.delete('equipamento')
    if (prob) p.set('problema', '1'); else p.delete('problema')
    const qs = p.toString()
    router.push(qs ? `/historico?${qs}` : '/historico')
  }

  return (
    <div className="flex items-center gap-3 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium" style={{ color: '#6b7280' }}>Filtrar por máquina:</label>
        <select value={equipamentoAtual} onChange={e => aplicar({ equipamento: e.target.value })}
          className="rounded-lg border px-3 py-1.5 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}>
          <option value="">Todas</option>
          {equipamentos.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#374151' }}>
        <input type="checkbox" checked={comProblema} onChange={e => aplicar({ problema: e.target.checked })} />
        Só com problema reportado
      </label>

      {(equipamentoAtual || comProblema) && (
        <button onClick={() => router.push('/historico')} className="text-xs underline" style={{ color: '#1d4ed8' }}>limpar filtros</button>
      )}
    </div>
  )
}
