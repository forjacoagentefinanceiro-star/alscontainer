'use client'

import { useState, useTransition } from 'react'
import type { Checklist } from '@/app/actions'
import { resolverPendencia } from '@/app/actions'

const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export function DesacordosSection({ initial }: { initial: Checklist[] }) {
  const [list, setList] = useState(initial)
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const count = list.length

  function resolver(id: string) {
    setErro(null)
    startTransition(async () => {
      const res = await resolverPendencia(id)
      if (res.error) setErro(res.error)
      else setList(prev => prev.filter(c => c.id !== id))
    })
  }

  return (
    <div
      id="desacordos"
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${count ? '#fecaca' : '#d1fae5'}`, background: count ? '#fef2f2' : '#f0fdf4' }}
    >
      {/* Cabeçalho / card clicável */}
      <button
        onClick={() => count > 0 && setAberto(o => !o)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3"
        style={{ cursor: count > 0 ? 'pointer' : 'default' }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-left" style={{ color: '#6b7280' }}>
            Itens em desacordo
          </p>
          <p className="text-3xl font-bold mt-0.5 text-left" style={{ color: count ? '#b91c1c' : '#047857' }}>
            {count}
          </p>
          <p className="text-xs mt-0.5 text-left" style={{ color: '#9ca3af' }}>não resolvidos</p>
        </div>
        {count > 0 && (
          <span className="text-xs font-semibold shrink-0" style={{ color: '#b91c1c' }}>
            {aberto ? 'ocultar ▲' : 'ver detalhes ▼'}
          </span>
        )}
      </button>

      {/* Lista expandida */}
      {aberto && count > 0 && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: '#fecaca' }}>
          {erro && (
            <p className="text-xs px-3 py-2 rounded mt-3" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              {erro}
            </p>
          )}
          {list.map(c => {
            const noks = (c.itens || []).filter(i => i.status === 'nok')
            return (
              <div key={c.id} className="bg-white rounded-lg p-3 mt-3" style={{ border: '1px solid #fecaca' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>
                      {c.equipamento} · {c.operador}
                    </p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      {dataHora(c.created_at)} · {c.turno}
                    </p>
                  </div>
                  <button
                    onClick={() => resolver(c.id)}
                    disabled={isPending}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50"
                    style={{ borderColor: '#a7f3d0', color: '#047857', background: '#ecfdf5' }}
                  >
                    Marcar resolvido
                  </button>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs" style={{ color: '#b91c1c' }}>
                  {noks.map((item, idx) => (
                    <li key={idx}>
                      • {item.item}{item.obs ? ` — ${item.obs}` : ''}
                      {item.foto && (
                        <a href={item.foto} target="_blank" rel="noopener noreferrer" className="ml-1 underline font-semibold">
                          ver foto
                        </a>
                      )}
                    </li>
                  ))}
                  {noks.length === 0 && (
                    <li className="italic" style={{ color: '#9ca3af' }}>Itens não especificados</li>
                  )}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
