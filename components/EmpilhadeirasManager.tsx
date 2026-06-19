'use client'

import { useState, useTransition } from 'react'
import type { Empilhadeira } from '@/app/actions'
import { addEmpilhadeira, deleteEmpilhadeira } from '@/app/actions'

export function EmpilhadeirasManager({ empilhadeiras, defaultOpen = false }: { empilhadeiras: Empilhadeira[]; defaultOpen?: boolean }) {
  const [list, setList] = useState(empilhadeiras)
  const [nome, setNome] = useState('')
  const [open, setOpen] = useState(defaultOpen)
  const [isPending, startTransition] = useTransition()

  function add() {
    const n = nome.trim()
    if (!n) return
    startTransition(async () => {
      const res = await addEmpilhadeira(n)
      if (!res.error) {
        setList(prev => [...prev, { id: crypto.randomUUID(), nome: n, ativo: true, created_at: new Date().toISOString() }].sort((a, b) => a.nome.localeCompare(b.nome)))
        setNome('')
      }
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteEmpilhadeira(id)
      if (!res.error) setList(prev => prev.filter(e => e.id !== id))
    })
  }

  return (
    <div className="bg-white rounded-xl max-w-3xl mb-5" style={{ border: '1px solid #e5e7eb' }}>
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: open ? '1px solid #f3f4f6' : 'none' }}>
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>Equipamentos cadastrados ({list.length})</span>
        <span className="text-xs" style={{ color: '#6b7280' }}>{open ? 'fechar' : 'gerenciar'}</span>
      </button>
      {open && (
        <div className="p-5">
          <div className="flex gap-2 mb-3">
            <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}
              placeholder="Identificação (nº / placa / modelo)" />
            <button onClick={add} disabled={isPending} className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>
              Adicionar
            </button>
          </div>
          {list.length === 0 ? (
            <p className="text-sm" style={{ color: '#9ca3af' }}>Nenhum equipamento cadastrado ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {list.map(e => (
                <span key={e.id} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full" style={{ background: '#f1f5f9', color: '#1a2a3a' }}>
                  {e.nome}
                  <button onClick={() => remove(e.id)} disabled={isPending} aria-label="Remover" className="font-bold leading-none" style={{ color: '#ef4444' }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
