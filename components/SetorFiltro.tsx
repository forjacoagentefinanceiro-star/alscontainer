'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Setor = { id: string; nome: string }

function SetorFiltroInner({ setores, setorAtual }: { setores: Setor[]; setorAtual?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function onChange(setor: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (setor) params.set('setor', setor)
    else params.delete('setor')
    router.push(`${pathname}?${params.toString()}`)
  }

  if (!setores.length) return null

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#6b7280' }}>
        Setor
      </label>
      <select
        value={setorAtual ?? ''}
        onChange={e => onChange(e.target.value)}
        className="text-xs rounded-lg px-3 py-1.5 font-medium"
        style={{
          border: setorAtual ? '1.5px solid #1B4F8A' : '1px solid #e5e7eb',
          background: setorAtual ? '#eff6ff' : '#fff',
          color: setorAtual ? '#1B4F8A' : '#374151',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="">Todos os setores</option>
        {setores.map(s => (
          <option key={s.id} value={s.nome}>{s.nome}</option>
        ))}
      </select>
      {setorAtual && (
        <button
          onClick={() => onChange('')}
          className="text-xs px-2 py-1 rounded"
          style={{ color: '#6b7280', background: '#f3f4f6' }}
          title="Limpar filtro de setor"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function SetorFiltro({ setores, setorAtual }: { setores: Setor[]; setorAtual?: string }) {
  return (
    <Suspense>
      <SetorFiltroInner setores={setores} setorAtual={setorAtual} />
    </Suspense>
  )
}
