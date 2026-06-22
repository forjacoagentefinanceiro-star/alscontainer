'use client'

import { useState, useTransition } from 'react'
import type { Checklist, OperacaoEvento } from '@/app/actions'
import { addEvento, encerrarOperacao } from '@/app/actions'

type Op = { checklist: Checklist; eventos: OperacaoEvento[] }
type Tipo = 'parada' | 'retorno' | 'encerramento'

export function OperacoesAbertas({ operacoes }: { operacoes: Op[] }) {
  const [list, setList] = useState(operacoes)
  const [acao, setAcao] = useState<{ id: string; tipo: Tipo } | null>(null)
  const [horim, setHorim] = useState('')
  const [motivo, setMotivo] = useState('')
  const [isPending, startTransition] = useTransition()

  const hora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  function confirmar() {
    if (!acao) return
    const h = horim ? parseFloat(horim.replace(',', '.')) : null
    const { id, tipo } = acao
    startTransition(async () => {
      if (tipo === 'encerramento') {
        const res = await encerrarOperacao(id, h)
        if (!res.error) { setList(prev => prev.filter(o => o.checklist.id !== id)); setAcao(null) }
      } else {
        const res = await addEvento(id, tipo, h, motivo)
        if (!res.error) {
          setList(prev => prev.map(o => o.checklist.id === id
            ? { ...o, eventos: [...o.eventos, { id: crypto.randomUUID(), checklist_id: id, tipo, motivo: motivo || null, horimetro: h, origem: 'app', created_at: new Date().toISOString() }] }
            : o))
          setAcao(null)
        }
      }
    })
  }

  if (!list.length) return null

  return (
    <div className="max-w-3xl mb-6">
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1a2a3a' }}>Operações em andamento</h2>
      <div className="space-y-3">
        {list.map(({ checklist: c, eventos }) => (
          <div key={c.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium" style={{ color: '#1a2a3a' }}>{c.equipamento} · {c.operador}</p>
                <p className="text-xs" style={{ color: '#9ca3af' }}>aberta {dataHora(c.created_at)} · horímetro inicial {c.horimetro ?? '—'}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#ecfdf5', color: '#047857' }}>aberta</span>
            </div>

            {eventos.length > 0 && (
              <ul className="mt-2 text-xs" style={{ color: '#6b7280' }}>
                {eventos.map(e => <li key={e.id}>• {hora(e.created_at)} — {e.tipo}{e.motivo ? ` (${e.motivo})` : ''}{e.horimetro != null ? ` · ${e.horimetro}h` : ''}</li>)}
              </ul>
            )}

            {acao?.id === c.id ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input value={horim} onChange={e => setHorim(e.target.value)} placeholder="Horímetro" inputMode="decimal" autoFocus
                  className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a', width: 130 }} />
                {acao.tipo === 'parada' && (
                  <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo (ex.: almoço)"
                    className="rounded-lg border px-3 py-2 text-sm outline-none flex-1" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }} />
                )}
                <button onClick={confirmar} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>
                  Confirmar {acao.tipo === 'encerramento' ? 'encerramento' : acao.tipo}
                </button>
                <button onClick={() => setAcao(null)} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#6b7280' }}>Cancelar</button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={() => { setAcao({ id: c.id, tipo: 'parada' }); setHorim(''); setMotivo('') }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fde68a', color: '#92400e', background: '#fffbeb' }}>Parada</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'retorno' }); setHorim(''); setMotivo('') }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#bfdbfe', color: '#1d4ed8', background: '#eff6ff' }}>Retorno</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'encerramento' }); setHorim(''); setMotivo('') }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fef2f2' }}>Encerrar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
