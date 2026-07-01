'use client'

import { useState, useTransition } from 'react'
import { setConfigCiclo } from '@/app/actions'
import { useRouter } from 'next/navigation'

export function MetaHorasCicloEditor({ metaAtual, diaInicioAtual }: { metaAtual: number; diaInicioAtual: number }) {
  const [editando, setEditando] = useState(false)
  const [meta, setMeta] = useState(String(metaAtual || ''))
  const [diaInicio, setDiaInicio] = useState(String(diaInicioAtual || 23))
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const diaFim = Math.max(1, parseInt(diaInicio || '23') - 1)

  function abrir() {
    setMeta(String(metaAtual || ''))
    setDiaInicio(String(diaInicioAtual || 23))
    setErro(null)
    setEditando(true)
  }

  function salvar() {
    const metaN = parseFloat(meta.replace(',', '.'))
    const diaInicioN = parseInt(diaInicio)
    if (!Number.isFinite(metaN) || metaN < 0) { setErro('Meta de horas inválida.'); return }
    if (!Number.isInteger(diaInicioN) || diaInicioN < 1 || diaInicioN > 28) { setErro('Dia de início deve ser entre 1 e 28.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await setConfigCiclo(metaN, diaInicioN)
      if (res.error) { setErro(res.error); return }
      setEditando(false)
      router.refresh()
    })
  }

  if (!editando) {
    return (
      <button onClick={abrir}
        className="mt-2 text-xs font-semibold px-2 py-1 rounded-lg border"
        style={{ color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}>
        {metaAtual > 0 ? 'Editar ciclo / meta' : 'Configurar ciclo e meta de horas'}
      </button>
    )
  }

  return (
    <div className="mt-2 p-2 rounded-lg space-y-2" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium" style={{ color: '#374151' }}>Dia de início:</label>
        <input
          type="number" min={1} max={28} value={diaInicio} onChange={e => setDiaInicio(e.target.value)}
          className="rounded border px-2 py-1 text-xs outline-none w-16" style={{ borderColor: '#1B4F8A', color: '#1a2a3a' }}
        />
        {parseInt(diaInicio) >= 2 && (
          <span className="text-xs" style={{ color: '#9ca3af' }}>
            → fim dia {diaFim} do mês seguinte
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-xs font-medium" style={{ color: '#374151' }}>Meta de horas:</label>
        <input
          type="number" min={0} value={meta} onChange={e => setMeta(e.target.value)}
          placeholder="0" autoFocus
          className="rounded border px-2 py-1 text-xs outline-none w-20" style={{ borderColor: '#1B4F8A', color: '#1a2a3a' }}
        />
        <span className="text-xs" style={{ color: '#6b7280' }}>h por ciclo (0 = sem meta)</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={salvar} disabled={isPending}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border text-white disabled:opacity-50"
          style={{ background: '#047857', borderColor: '#047857' }}>
          Salvar
        </button>
        <button onClick={() => setEditando(false)}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border"
          style={{ color: '#6b7280', borderColor: '#e5e7eb', background: '#fff' }}>
          Cancelar
        </button>
        {erro && <span className="text-xs" style={{ color: '#b91c1c' }}>{erro}</span>}
      </div>
    </div>
  )
}
