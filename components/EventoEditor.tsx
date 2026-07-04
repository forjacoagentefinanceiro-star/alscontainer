'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { OperacaoEvento } from '@/app/actions'
import { updateEventoHorimetro, updateEventoHorario, excluirEvento, setEventoLitros } from '@/app/actions'
import { HorimetroInput } from '@/components/HorimetroInput'

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function fromDatetimeLocal(value: string): string {
  return new Date(`${value}:00-03:00`).toISOString()
}

const horaFmt = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
const dataHoraFmt = (s: string) => new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

const btnBase = 'text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors active:scale-95'

export function EventoEditor({ evento, podeEditar, onDeleted, prefixo = true, permitirExcluir = true }: {
  evento: OperacaoEvento; podeEditar: boolean; onDeleted: () => void; prefixo?: boolean; permitirExcluir?: boolean
}) {
  const [e, setE] = useState(evento)
  useEffect(() => { setE(evento) }, [evento])
  const [modo, setModo] = useState<'ver' | 'editar' | 'excluir'>('ver')
  const [horimVal, setHorimVal] = useState<number | null>(evento.horimetro ?? null)
  const [horarioVal, setHorarioVal] = useState(() => toDatetimeLocal(evento.created_at))
  const [litrosVal, setLitrosVal] = useState<string>(evento.litros != null ? String(evento.litros) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function abrirEditar() {
    setHorimVal(e.horimetro ?? null)
    setHorarioVal(toDatetimeLocal(e.created_at))
    setLitrosVal(e.litros != null ? String(e.litros) : '')
    setErro(null)
    setModo('editar')
  }

  function salvar() {
    setErro(null)
    startTransition(async () => {
      const novoHorarioISO = fromDatetimeLocal(horarioVal)
      if (Math.abs(new Date(novoHorarioISO).getTime() - new Date(e.created_at).getTime()) > 1000) {
        const resH = await updateEventoHorario(e.id, novoHorarioISO)
        if (resH.error) { setErro(resH.error); return }
      }
      if (horimVal !== e.horimetro) {
        const resV = await updateEventoHorimetro(e.id, horimVal)
        if (resV.error) { setErro(resV.error); return }
      }
      // edição de litros (só quando o evento tem abastecimento)
      if (e.litros != null) {
        const novoLitros = litrosVal.trim() === '' ? null : parseFloat(litrosVal.replace(',', '.'))
        if (novoLitros !== e.litros) {
          if (novoLitros !== null && (isNaN(novoLitros) || novoLitros < 0)) {
            setErro('Litros inválido.'); return
          }
          const resL = await setEventoLitros(e.id, novoLitros)
          if (resL.error) { setErro(resL.error); return }
          setE(prev => ({ ...prev, litros: novoLitros, consumo_lh: resL.consumo_lh ?? null }))
        }
      }
      setE(prev => ({ ...prev, horimetro: horimVal, created_at: novoHorarioISO, editado_em: new Date().toISOString() }))
      setModo('ver')
      router.refresh()
    })
  }

  function excluir() {
    setErro(null)
    startTransition(async () => {
      const res = await excluirEvento(e.id)
      if (res.error) { setErro(res.error); return }
      onDeleted()
      router.refresh()
    })
  }

  const Wrapper: 'li' | 'span' = prefixo ? 'li' : 'span'

  return (
    <Wrapper className="flex items-start gap-1.5 flex-wrap py-0.5">
      {prefixo && <span>• {horaFmt(e.created_at)} — {e.tipo}{e.motivo ? ` (${e.motivo})` : ''} ·</span>}

      {modo === 'editar' ? (
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <HorimetroInput value={horimVal} onChange={setHorimVal} placeholder="Horímetro"
            className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#1B4F8A', color: '#1a2a3a', width: 90 }} />
          <input type="datetime-local" value={horarioVal} onChange={ev => setHorarioVal(ev.target.value)}
            className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#1B4F8A', color: '#1a2a3a' }} />
          {e.litros != null && (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs" style={{ color: '#9a3412' }}>⛽</span>
              <input
                type="number" min="0" step="0.1"
                value={litrosVal}
                onChange={ev => setLitrosVal(ev.target.value)}
                placeholder="Litros"
                className="rounded border px-2 py-1 text-xs outline-none"
                style={{ borderColor: '#c2410c', color: '#1a2a3a', width: 80 }}
              />
              <span className="text-xs" style={{ color: '#9a3412' }}>L</span>
            </span>
          )}
          <button onClick={salvar} disabled={isPending} className={`${btnBase} text-white disabled:opacity-50`} style={{ background: '#047857', borderColor: '#047857' }}>
            Salvar
          </button>
          <button onClick={() => setModo('ver')} className={btnBase} style={{ color: '#6b7280', borderColor: '#e5e7eb', background: '#fff' }}>
            Cancelar
          </button>
        </span>
      ) : (
        <>
          <span>{e.horimetro != null ? `${e.horimetro}h` : '— h'}</span>
          {e.litros != null && (
            <span style={{ color: '#9a3412' }}>· ⛽ {e.litros}L{e.consumo_lh != null ? ` · ${e.consumo_lh} L/h` : ''}</span>
          )}
          {e.editado_em && (
            <span title={`Editado em ${dataHoraFmt(e.editado_em)}`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#92400e' }}>
              ✏️ editado
            </span>
          )}
          {podeEditar && modo === 'ver' && (
            <span className="inline-flex items-center gap-1.5">
              <button onClick={abrirEditar} className={btnBase} style={{ color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}>
                Editar
              </button>
              {permitirExcluir && (
                <button onClick={() => setModo('excluir')} className={btnBase} style={{ color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}>
                  Excluir
                </button>
              )}
            </span>
          )}
        </>
      )}

      {modo === 'excluir' && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-xs font-medium" style={{ color: '#b91c1c' }}>Excluir este lançamento?</span>
          <button onClick={excluir} disabled={isPending} className={`${btnBase} text-white disabled:opacity-50`} style={{ background: '#b91c1c', borderColor: '#b91c1c' }}>
            Sim, excluir
          </button>
          <button onClick={() => setModo('ver')} className={btnBase} style={{ color: '#6b7280', borderColor: '#e5e7eb', background: '#fff' }}>
            Cancelar
          </button>
        </span>
      )}

      {erro && <span className="text-xs font-medium" style={{ color: '#b91c1c' }}>{erro}</span>}
    </Wrapper>
  )
}
