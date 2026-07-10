'use client'

import { useState, useTransition } from 'react'
import type { Empilhadeira, Setor } from '@/app/actions'
import { addEmpilhadeira, updateEmpilhadeira, deleteEmpilhadeira } from '@/app/actions'

export function EmpilhadeirasManager({
  empilhadeiras,
  setores,
  defaultOpen = false,
}: {
  empilhadeiras: Empilhadeira[]
  setores: Setor[]
  defaultOpen?: boolean
}) {
  const [list, setList] = useState(empilhadeiras)
  const [nome, setNome] = useState('')
  const [setor, setSetor] = useState('')
  const [open, setOpen] = useState(defaultOpen)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editSetor, setEditSetor] = useState('')
  const [isPending, startTransition] = useTransition()

  function add() {
    const n = nome.trim()
    if (!n) return
    startTransition(async () => {
      const res = await addEmpilhadeira(n, setor || undefined)
      if (!res.error) {
        setList(prev => [...prev, {
          id: crypto.randomUUID(),
          nome: n,
          setor: setor || null,
          ativo: true,
          horimetro_atual: null,
          created_at: new Date().toISOString(),
        }].sort((a, b) => a.nome.localeCompare(b.nome)))
        setNome('')
        setSetor('')
      }
    })
  }

  function salvarEdicao(id: string) {
    const n = editNome.trim()
    if (!n) return
    startTransition(async () => {
      const res = await updateEmpilhadeira(id, n, editSetor || undefined)
      if (!res.error) {
        setList(prev => prev.map(e => e.id === id ? { ...e, nome: n, setor: editSetor || null } : e)
          .sort((a, b) => a.nome.localeCompare(b.nome)))
        setEditId(null)
      }
    })
  }

  function remove(id: string) {
    if (!confirm('Remover este equipamento?')) return
    startTransition(async () => {
      const res = await deleteEmpilhadeira(id)
      if (!res.error) setList(prev => prev.filter(e => e.id !== id))
    })
  }

  const inp = 'rounded-lg border px-3 py-2 text-sm outline-none'
  const btn = 'text-xs px-2.5 py-1 rounded border transition-colors'

  const SetorSelect = ({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={compact ? 'w-32 rounded border px-2 py-1.5 text-sm outline-none' : `w-40 ${inp}`}
      style={{ borderColor: '#d1d5db', color: value ? '#1a2a3a' : '#9ca3af' }}
    >
      <option value="">Sem setor</option>
      {setores.map(s => (
        <option key={s.id} value={s.nome}>{s.nome}</option>
      ))}
    </select>
  )

  return (
    <div className="bg-white rounded-xl max-w-3xl mb-5" style={{ border: '1px solid #e5e7eb' }}>
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: open ? '1px solid #f3f4f6' : 'none' }}>
        <span className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>Equipamentos cadastrados ({list.length})</span>
        <span className="text-xs" style={{ color: '#6b7280' }}>{open ? 'fechar' : 'gerenciar'}</span>
      </button>

      {open && (
        <div className="p-5">
          {setores.length === 0 && (
            <p className="text-xs mb-3 px-3 py-2 rounded" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
              Cadastre setores primeiro para associar equipamentos a um setor.
            </p>
          )}

          {/* Formulário de adição */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <input value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
              className={`flex-1 min-w-32 ${inp}`} style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}
              placeholder="Identificação (nº / placa / modelo)" />
            <SetorSelect value={setor} onChange={setSetor} />
            <button onClick={add} disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#1B4F8A' }}>
              Adicionar
            </button>
          </div>

          {list.length === 0 ? (
            <p className="text-sm" style={{ color: '#9ca3af' }}>Nenhum equipamento cadastrado ainda.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {list.map(e => (
                <div key={e.id} className="flex items-center gap-2 py-2 flex-wrap">
                  {editId === e.id ? (
                    <>
                      <input value={editNome} onChange={ev => setEditNome(ev.target.value)}
                        onKeyDown={ev => { if (ev.key === 'Enter') salvarEdicao(e.id); if (ev.key === 'Escape') setEditId(null) }}
                        autoFocus className="flex-1 min-w-28 rounded border px-2 py-1.5 text-sm outline-none"
                        style={{ borderColor: '#1B4F8A', color: '#1a2a3a' }} />
                      <SetorSelect value={editSetor} onChange={setEditSetor} compact />
                      <button onClick={() => salvarEdicao(e.id)} disabled={isPending}
                        className={btn} style={{ borderColor: '#a7f3d0', color: '#047857' }}>Salvar</button>
                      <button onClick={() => setEditId(null)}
                        className={btn} style={{ borderColor: '#e5e7eb', color: '#6b7280' }}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm" style={{ color: '#1a2a3a' }}>
                        {e.nome}
                        {e.setor && (
                          <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                            {e.setor}
                          </span>
                        )}
                        {e.horimetro_atual != null && (
                          <span className="ml-2 text-xs" style={{ color: '#6b7280' }}>· horímetro {e.horimetro_atual}h</span>
                        )}
                      </span>
                      <button onClick={() => { setEditId(e.id); setEditNome(e.nome); setEditSetor(e.setor ?? '') }}
                        className={btn} style={{ borderColor: '#bfdbfe', color: '#1d4ed8' }}>Editar</button>
                      <button onClick={() => remove(e.id)} disabled={isPending}
                        className={btn} style={{ borderColor: '#fecaca', color: '#ef4444' }}>Remover</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
