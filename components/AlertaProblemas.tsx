'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { ProblemaEquipamento } from '@/app/actions'
import { resolverProblema } from '@/app/actions'

export function AlertaProblemas({ problemas }: { problemas: ProblemaEquipamento[] }) {
  const [list, setList] = useState(problemas)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!list.length) return null

  function resolver(id: string) {
    setErro(null)
    startTransition(async () => {
      const res = await resolverProblema(id)
      if (res.error) setErro(res.error)
      else setList(prev => prev.filter(p => p.id !== id))
    })
  }

  const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const parados = list.filter(p => p.parado).length

  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #fecaca', background: '#fef2f2' }}>
      <button onClick={() => setAberto(o => !o)} className="w-full px-4 py-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: '#b91c1c' }}>
          <span className="text-lg">⚠️</span>
          {list.length} problema(s) reportado(s) {parados > 0 ? `· ${parados} com máquina parada` : ''}
        </span>
        <span className="text-xs font-semibold" style={{ color: '#b91c1c' }}>{aberto ? 'ocultar' : 'ver'}</span>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          {erro && <p className="text-xs px-3 py-2 rounded" style={{ background: '#fee2e2', color: '#b91c1c' }}>{erro}</p>}
          {list.map(p => (
            <div key={p.id} className="bg-white rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap" style={{ border: '1px solid #fecaca' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{p.equipamento} · {p.operador}</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(p.created_at)}{p.horimetro != null ? ` · ${p.horimetro}h` : ''}</p>
                <p className="text-xs mt-1" style={{ color: '#374151' }}>{p.descricao}</p>
                <p className="text-xs mt-0.5 font-semibold" style={{ color: p.parado ? '#b91c1c' : '#92400e' }}>
                  {p.parado ? 'Máquina parada por causa do problema' : 'Operando normalmente'}
                </p>
                {(p.fotos ?? []).length > 0 && (
                  <div className="flex gap-2 mt-1">
                    {(p.fotos ?? []).map((f, i) => (
                      <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="text-xs underline font-semibold" style={{ color: '#1d4ed8' }}>foto{(p.fotos?.length ?? 0) > 1 ? ` ${i + 1}` : ''}</a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/historico?equipamento=${encodeURIComponent(p.equipamento)}#checklist-${p.checklist_id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border whitespace-nowrap" style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fff' }}>
                  Abrir checklist →
                </Link>
                <button onClick={() => resolver(p.id)} disabled={isPending}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5' }}>
                  Marcar resolvido
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
