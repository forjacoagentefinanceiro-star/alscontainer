'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { Checklist } from '@/app/actions'
import { resolverPendencia } from '@/app/actions'

export function AlertaDesacordos({ checklists }: { checklists: Checklist[] }) {
  const [list, setList] = useState(checklists)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!list.length) return null

  function resolver(id: string) {
    setErro(null)
    startTransition(async () => {
      const res = await resolverPendencia(id)
      if (res.error) setErro(res.error)
      else setList(prev => prev.filter(c => c.id !== id))
    })
  }

  const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #fecaca', background: '#fef2f2' }}>
      <button onClick={() => setAberto(o => !o)} className="w-full px-4 py-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-bold" style={{ color: '#b91c1c' }}>
          <span className="text-lg">⚠️</span>
          {list.length} equipamento(s) com itens do checklist em desacordo
        </span>
        <span className="text-xs font-semibold" style={{ color: '#b91c1c' }}>{aberto ? 'ocultar' : 'ver'}</span>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3">
          {erro && <p className="text-xs px-3 py-2 rounded" style={{ background: '#fee2e2', color: '#b91c1c' }}>{erro}</p>}
          {list.map(c => {
            const noks = (c.itens || []).filter(i => i.status === 'nok')
            return (
              <div key={c.id} className="bg-white rounded-lg p-3" style={{ border: '1px solid #fecaca' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{c.equipamento} · {c.operador}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(c.created_at)} · {c.turno}</p>
                  </div>
                  <button onClick={() => resolver(c.id)} disabled={isPending}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5' }}>
                    Marcar resolvido
                  </button>
                </div>
                <ul className="mt-2 text-xs" style={{ color: '#b91c1c' }}>
                  {noks.map((i, idx) => (
                    <li key={idx}>
                      • {i.item}{i.obs ? ` — ${i.obs}` : ''}
                      {i.foto && <a href={i.foto} target="_blank" rel="noopener noreferrer" className="ml-1 underline font-semibold">ver foto</a>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          <Link href="/checklist" className="inline-block text-xs font-semibold underline" style={{ color: '#b91c1c' }}>Ir para o checklist →</Link>
        </div>
      )}
    </div>
  )
}
