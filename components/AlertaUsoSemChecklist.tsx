'use client'

import { useState, useTransition } from 'react'
import type { UsoSemChecklist } from '@/app/actions'
import { resolverUsoSemChecklist } from '@/app/actions'

export function AlertaUsoSemChecklist({ usos }: { usos: UsoSemChecklist[] }) {
  const [list, setList] = useState(usos)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!list.length) return null

  function resolver(id: string) {
    setErro(null)
    startTransition(async () => {
      const res = await resolverUsoSemChecklist(id)
      if (res.error) setErro(res.error)
      else setList(prev => prev.filter(u => u.id !== id))
    })
  }

  const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #fed7aa', background: '#fff7ed' }}>
      <button onClick={() => setAberto(o => !o)} className="w-full px-4 py-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: '#b45309' }}>
          <span className="text-lg">🛠️</span>
          {list.length} uso(s) de máquina sem checklist
        </span>
        <span className="text-xs font-semibold" style={{ color: '#b45309' }}>{aberto ? 'ocultar' : 'ver'}</span>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          {erro && <p className="text-xs px-3 py-2 rounded" style={{ background: '#fee2e2', color: '#b91c1c' }}>{erro}</p>}
          {list.map(u => (
            <div key={u.id} className="bg-white rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap" style={{ border: '1px solid #fed7aa' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{u.equipamento} · {u.operador}</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(u.created_at)}{u.horimetro != null ? ` · horímetro do retorno ${u.horimetro}h` : ''}</p>
                <p className="text-xs mt-1" style={{ color: '#b45309' }}>Máquina utilizada durante a parada, sem checklist.</p>
              </div>
              <button onClick={() => resolver(u.id)} disabled={isPending}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5' }}>
                Marcar visto
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
