'use client'

import { useState, useTransition } from 'react'
import { setMetaHorasCiclo } from '@/app/actions'
import { useRouter } from 'next/navigation'

export function MetaHorasCicloEditor({ metaAtual }: { metaAtual: number }) {
  const [editando, setEditando] = useState(false)
  const [val, setVal] = useState(String(metaAtual || ''))
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function salvar() {
    const n = parseFloat(val.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) { setErro('Informe um valor válido.'); return }
    setErro(null)
    startTransition(async () => {
      const res = await setMetaHorasCiclo(n)
      if (res.error) { setErro(res.error); return }
      setEditando(false)
      router.refresh()
    })
  }

  if (!editando) {
    return (
      <button onClick={() => { setVal(String(metaAtual || '')); setEditando(true) }}
        className="mt-2 text-xs font-semibold px-2 py-1 rounded-lg border"
        style={{ color: '#1d4ed8', borderColor: '#bfdbfe', background: '#eff6ff' }}>
        {metaAtual > 0 ? 'Editar meta' : 'Definir meta de horas'}
      </button>
    )
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      <input
        type="number" value={val} onChange={e => setVal(e.target.value)}
        placeholder="Horas meta do ciclo" autoFocus
        className="rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: '#1B4F8A', color: '#1a2a3a', width: 120 }}
      />
      <span className="text-xs" style={{ color: '#6b7280' }}>h</span>
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
  )
}
