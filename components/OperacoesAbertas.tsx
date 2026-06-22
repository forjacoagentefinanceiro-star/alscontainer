'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Checklist, OperacaoEvento } from '@/app/actions'
import { addEvento, encerrarOperacao, updateChecklistHorimetro, updateEventoHorimetro } from '@/app/actions'

type Op = { checklist: Checklist; eventos: OperacaoEvento[] }
type Tipo = 'parada' | 'retorno' | 'encerramento'

export function OperacoesAbertas({ operacoes, podeEditar = false }: { operacoes: Op[]; podeEditar?: boolean }) {
  const [list, setList] = useState(operacoes)
  const [acao, setAcao] = useState<{ id: string; tipo: Tipo } | null>(null)
  const [horim, setHorim] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [edit, setEdit] = useState<{ kind: 'inicial' | 'evento'; id: string } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const hora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const num = (v: string) => (v.trim() === '' ? null : parseFloat(v.replace(',', '.')))

  function confirmar() {
    if (!acao) return
    setErro(null)
    const h = num(horim)
    const { id, tipo } = acao
    startTransition(async () => {
      if (tipo === 'encerramento') {
        const res = await encerrarOperacao(id, h)
        if (res.error) setErro(res.error)
        else { setList(prev => prev.filter(o => o.checklist.id !== id)); setAcao(null) }
      } else {
        const res = await addEvento(id, tipo, h, motivo)
        if (res.error) setErro(res.error)
        else {
          setList(prev => prev.map(o => o.checklist.id === id
            ? { ...o, eventos: [...o.eventos, { id: crypto.randomUUID(), checklist_id: id, tipo, motivo: motivo || null, horimetro: h, origem: 'app', created_at: new Date().toISOString() }] }
            : o))
          setAcao(null)
          router.refresh()
        }
      }
    })
  }

  function salvarEdit() {
    if (!edit) return
    setErro(null)
    const v = num(editVal)
    const { kind, id } = edit
    startTransition(async () => {
      const res = kind === 'inicial' ? await updateChecklistHorimetro(id, 'horimetro', v) : await updateEventoHorimetro(id, v)
      if (res.error) { setErro(res.error); return }
      if (kind === 'inicial') setList(prev => prev.map(o => o.checklist.id === id ? { ...o, checklist: { ...o.checklist, horimetro: v } } : o))
      else setList(prev => prev.map(o => ({ ...o, eventos: o.eventos.map(e => e.id === id ? { ...e, horimetro: v } : e) })))
      setEdit(null)
      router.refresh()
    })
  }

  function abrirEdit(kind: 'inicial' | 'evento', id: string, atual: number | null) {
    setEdit({ kind, id }); setEditVal(atual != null ? String(atual) : ''); setErro(null)
  }

  if (!list.length) return null

  const editInput = (
    <span className="inline-flex items-center gap-1">
      <input value={editVal} onChange={e => setEditVal(e.target.value)} inputMode="decimal" autoFocus
        className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#1B4F8A', color: '#1a2a3a', width: 90 }} />
      <button onClick={salvarEdit} disabled={isPending} className="text-xs font-semibold" style={{ color: '#047857' }}>salvar</button>
      <button onClick={() => setEdit(null)} className="text-xs" style={{ color: '#6b7280' }}>cancelar</button>
    </span>
  )

  return (
    <div className="max-w-3xl mb-6">
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1a2a3a' }}>Operações em andamento</h2>
      {erro && <p className="text-sm mb-3 px-3 py-2 rounded" style={{ background: '#fef2f2', color: '#b91c1c' }}>{erro}</p>}
      <div className="space-y-3">
        {list.map(({ checklist: c, eventos }) => (
          <div key={c.id} className="bg-white rounded-lg p-4" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium" style={{ color: '#1a2a3a' }}>{c.equipamento} · {c.operador}</p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#9ca3af' }}>
                  aberta {dataHora(c.created_at)} · horímetro inicial{' '}
                  {edit?.kind === 'inicial' && edit.id === c.id ? editInput : (
                    <>
                      <strong style={{ color: '#1a2a3a' }}>{c.horimetro ?? '—'}</strong>
                      {podeEditar && <button onClick={() => abrirEdit('inicial', c.id, c.horimetro)} className="underline" style={{ color: '#1d4ed8' }}>editar</button>}
                    </>
                  )}
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: '#ecfdf5', color: '#047857' }}>aberta</span>
            </div>

            {eventos.length > 0 && (
              <ul className="mt-2 text-xs space-y-1" style={{ color: '#6b7280' }}>
                {eventos.map(e => (
                  <li key={e.id} className="flex items-center gap-1 flex-wrap">
                    • {hora(e.created_at)} — {e.tipo}{e.motivo ? ` (${e.motivo})` : ''} ·{' '}
                    {edit?.kind === 'evento' && edit.id === e.id ? editInput : (
                      <>
                        {e.horimetro != null ? `${e.horimetro}h` : '— h'}
                        {podeEditar && <button onClick={() => abrirEdit('evento', e.id, e.horimetro)} className="underline" style={{ color: '#1d4ed8' }}>editar</button>}
                      </>
                    )}
                  </li>
                ))}
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
                <button onClick={() => { setAcao(null); setErro(null) }} className="px-3 py-2 rounded-lg text-sm" style={{ color: '#6b7280' }}>Cancelar</button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2 flex-wrap">
                <button onClick={() => { setAcao({ id: c.id, tipo: 'parada' }); setHorim(''); setMotivo(''); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fde68a', color: '#92400e', background: '#fffbeb' }}>Parada</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'retorno' }); setHorim(''); setMotivo(''); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#bfdbfe', color: '#1d4ed8', background: '#eff6ff' }}>Retorno</button>
                <button onClick={() => { setAcao({ id: c.id, tipo: 'encerramento' }); setHorim(''); setMotivo(''); setErro(null) }} className="px-3 py-2 rounded-lg text-sm font-semibold border" style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fef2f2' }}>Encerrar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
