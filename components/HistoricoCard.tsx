'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Checklist, OperacaoEvento, ChecklistItem } from '@/app/actions'
import { updateChecklistItens, updateChecklistHorimetro } from '@/app/actions'
import { ProblemaTratativa } from '@/components/ProblemaTratativa'
import { HorimetroInput } from '@/components/HorimetroInput'
import { EventoEditor } from '@/components/EventoEditor'

const dataHora = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const hora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })

type St = 'ok' | 'nok' | 'na'
const OPCOES: { v: St; label: string; on: string }[] = [
  { v: 'ok', label: 'OK', on: '#16a34a' },
  { v: 'nok', label: 'Não OK', on: '#dc2626' },
  { v: 'na', label: 'N/A', on: '#6b7280' },
]

type EditAlvo = { kind: 'inicial' | 'final'; id: string }

export function HistoricoCard({ checklist, eventos, podeEditar }: { checklist: Checklist; eventos: OperacaoEvento[]; podeEditar: boolean }) {
  const [c, setC] = useState(checklist)
  const [evs, setEvs] = useState(eventos)
  const [editandoItens, setEditandoItens] = useState(false)
  const [itensEdit, setItensEdit] = useState<ChecklistItem[]>(checklist.itens || [])
  const [editHorim, setEditHorim] = useState<EditAlvo | null>(null)
  const [editVal, setEditVal] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // re-sincroniza com o servidor (LiveRefresh) — sem sobrescrever uma edição em andamento
  useEffect(() => { if (!editandoItens) { setC(checklist); setEvs(eventos) } }, [checklist, eventos, editandoItens])

  const noks = (c.itens || []).filter(i => i.status === 'nok')
  const encerrada = c.status === 'encerrada'
  const horas = encerrada && c.horimetro != null && c.horimetro_final != null ? Math.round((c.horimetro_final - c.horimetro) * 100) / 100 : null

  function salvarItens() {
    setErro(null)
    startTransition(async () => {
      const res = await updateChecklistItens(c.id, itensEdit)
      if (res.error) { setErro(res.error); return }
      const tem_pendencia = itensEdit.some(i => i.status === 'nok')
      setC(prev => ({ ...prev, itens: itensEdit, tem_pendencia }))
      setEditandoItens(false)
      router.refresh()
    })
  }

  function abrirEditHorim(kind: EditAlvo['kind'], id: string, atual: number | null) {
    setEditHorim({ kind, id }); setEditVal(atual); setErro(null)
  }

  function salvarHorim() {
    if (!editHorim) return
    setErro(null)
    const v = editVal
    const { kind, id } = editHorim
    startTransition(async () => {
      const res = await updateChecklistHorimetro(id, kind === 'inicial' ? 'horimetro' : 'horimetro_final', v)
      if (res.error) { setErro(res.error); return }
      if (kind === 'inicial') setC(prev => ({ ...prev, horimetro: v }))
      else setC(prev => ({ ...prev, horimetro_final: v }))
      setEditHorim(null)
      router.refresh()
    })
  }

  const horimInput = (
    <span className="inline-flex items-center gap-1.5">
      <HorimetroInput key={`${editHorim?.kind}-${editHorim?.id}`} value={editVal} onChange={setEditVal} placeholder="0.0" autoFocus
        className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#1B4F8A', color: '#1a2a3a', width: 90 }} />
      <button onClick={salvarHorim} disabled={isPending} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border text-white disabled:opacity-50" style={{ background: '#047857', borderColor: '#047857' }}>Salvar</button>
      <button onClick={() => setEditHorim(null)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: '#6b7280', borderColor: '#e5e7eb' }}>Cancelar</button>
    </span>
  )

  return (
    <div id={`checklist-${c.id}`} className="bg-white rounded-lg p-4 scroll-mt-20" style={{ border: '1px solid #e5e7eb' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{c.equipamento} · {c.operador}</p>
          <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(c.created_at)} · {c.turno}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={encerrada ? { background: '#eef2ff', color: '#4338ca' } : { background: '#ecfdf5', color: '#047857' }}>
          {encerrada ? 'encerrada' : 'aberta'}
        </span>
      </div>

      {erro && <p className="text-xs mt-2 px-3 py-2 rounded" style={{ background: '#fef2f2', color: '#b91c1c' }}>{erro}</p>}

      <p className="text-xs mt-2 flex items-center gap-1 flex-wrap" style={{ color: '#6b7280' }}>
        Horímetro:{' '}
        {editHorim?.kind === 'inicial' ? horimInput : (
          <>
            <strong style={{ color: '#1a2a3a' }}>{c.horimetro ?? '—'}</strong>
            {podeEditar && <button onClick={() => abrirEditHorim('inicial', c.id, c.horimetro)} className="text-xs font-semibold px-2 py-1 rounded-lg border" style={{ color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}>Editar</button>}
          </>
        )}
        {encerrada && (
          <>
            {' → '}
            {editHorim?.kind === 'final' ? horimInput : (
              <>
                <strong style={{ color: '#1a2a3a' }}>{c.horimetro_final ?? '—'}</strong>
                {podeEditar && <button onClick={() => abrirEditHorim('final', c.id, c.horimetro_final)} className="text-xs font-semibold px-2 py-1 rounded-lg border" style={{ color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}>Editar</button>}
              </>
            )}
          </>
        )}
        {horas != null && <> · <strong style={{ color: '#1a2a3a' }}>{horas}h</strong> trabalhadas</>}
      </p>

      {!editandoItens ? (
        <>
          {noks.length > 0 && (
            <ul className="mt-2 text-xs" style={{ color: '#b91c1c' }}>
              {noks.map((i, idx) => (
                <li key={idx}>
                  • {i.item}{i.obs ? ` — ${i.obs}` : ''}
                  {i.foto && <a href={i.foto} target="_blank" rel="noopener noreferrer" className="ml-1 underline font-semibold">ver foto</a>}
                </li>
              ))}
            </ul>
          )}
          {podeEditar && (
            <button onClick={() => { setItensEdit(c.itens || []); setEditandoItens(true); setErro(null) }} className="mt-2 text-xs underline" style={{ color: '#1d4ed8' }}>
              Editar itens do checklist
            </button>
          )}
        </>
      ) : (
        <div className="mt-2 p-3 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {itensEdit.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2 flex-wrap text-xs">
                <span className="flex-1" style={{ color: '#374151' }}>{it.item}</span>
                {OPCOES.map(op => (
                  <button key={op.v} onClick={() => setItensEdit(prev => prev.map((p, i) => i === idx ? { ...p, status: op.v } : p))}
                    className="px-2 py-1 rounded border text-xs font-semibold"
                    style={{ background: it.status === op.v ? op.on : '#fff', color: it.status === op.v ? '#fff' : '#6b7280', borderColor: it.status === op.v ? op.on : '#d1d5db' }}>
                    {op.label}
                  </button>
                ))}
                {it.status === 'nok' && (
                  <input value={it.obs || ''} onChange={e => setItensEdit(prev => prev.map((p, i) => i === idx ? { ...p, obs: e.target.value } : p))}
                    placeholder="observação" className="rounded border px-2 py-1 text-xs outline-none flex-1" style={{ borderColor: '#fecaca', color: '#1a2a3a', minWidth: 120 }} />
                )}
                {it.foto && <a href={it.foto} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#1d4ed8' }}>foto</a>}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={salvarItens} disabled={isPending} className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>Salvar itens</button>
            <button onClick={() => setEditandoItens(false)} className="px-3 py-2 rounded-lg text-xs" style={{ color: '#6b7280' }}>Cancelar</button>
          </div>
        </div>
      )}

      {evs.length > 0 && (
        <ul className="mt-2 text-xs space-y-1" style={{ color: '#6b7280' }}>
          {evs.map(e => e.tipo === 'problema' ? (
            <li key={e.id} className="py-2" style={{ borderTop: '1px dashed #fecaca', borderBottom: '1px dashed #fecaca' }}>
              <div className="flex items-start gap-1 flex-wrap">
                <span style={{ color: '#b91c1c' }}>⚠️ {hora(e.created_at)} — problema:</span>
                <span>{e.descricao}</span>
                <span className="font-semibold" style={{ color: e.parado ? '#b91c1c' : '#92400e' }}>{e.parado ? '· máquina parada' : '· operando normalmente'}</span>
                <EventoEditor evento={e} podeEditar={podeEditar} prefixo={false} permitirExcluir={false}
                  onDeleted={() => setEvs(prev => prev.filter(x => x.id !== e.id))} />
                {(e.fotos ?? []).map((f, i) => (
                  <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#1d4ed8' }}>foto{(e.fotos?.length ?? 0) > 1 ? ` ${i + 1}` : ''}</a>
                ))}
              </div>
              <ProblemaTratativa evento={e} podeAcionar={podeEditar} />
            </li>
          ) : (
            <EventoEditor key={e.id} evento={e} podeEditar={podeEditar} onDeleted={() => setEvs(prev => prev.filter(x => x.id !== e.id))} />
          ))}
        </ul>
      )}

      {c.observacoes && <p className="mt-2 text-xs" style={{ color: '#6b7280' }}>Obs: {c.observacoes}</p>}
    </div>
  )
}
