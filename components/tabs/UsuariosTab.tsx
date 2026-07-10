'use client'

import { useState, useTransition } from 'react'
import type { UserProfile, Setor } from '@/app/actions'
import { approveUser, updateUserRole, revokeUser, updateUserBiAbas, updateUserModulos, redefinirSenhaOperador, updateUserSetor, updateUserTelegramChatId } from '@/app/actions'
import { BI_ABAS, BI_ABAS_KEYS } from '@/lib/bi/abas'
import { MODULOS, MODULOS_KEYS } from '@/lib/modulos'

const roleLabel = { admin: 'Admin', editor: 'Editor', viewer: 'Visualizador', operador: 'Operador' }
const roleColor = {
  admin:    { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  editor:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  viewer:   { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  operador: { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
}

export function UsuariosTab({ users, setores }: { users: UserProfile[]; setores: Setor[] }) {
  const [list, setList] = useState(users)
  const [isPending, startTransition] = useTransition()
  const [openAbas, setOpenAbas]       = useState<string | null>(null)
  const [openModulos, setOpenModulos] = useState<string | null>(null)
  const [openExtra, setOpenExtra]     = useState<string | null>(null) // setor + telegram
  const [resetId, setResetId]   = useState<string | null>(null)
  const [resetVal, setResetVal] = useState('')
  const [resetMsg, setResetMsg] = useState<{ id: string; txt: string; ok: boolean } | null>(null)
  // estados locais para campos inline de setor e telegram
  const [editSetor, setEditSetor]   = useState<Record<string, string>>({})
  const [editTg, setEditTg]         = useState<Record<string, string>>({})

  function handleReset(userId: string) {
    setResetMsg(null)
    startTransition(async () => {
      const res = await redefinirSenhaOperador(userId, resetVal)
      if (res.error) setResetMsg({ id: userId, txt: res.error, ok: false })
      else { setResetMsg({ id: userId, txt: '✓ Senha redefinida. O usuário trocará no próximo acesso.', ok: true }); setResetId(null); setResetVal('') }
    })
  }

  function toggleAba(u: UserProfile, key: string, checked: boolean) {
    const atual = u.bi_abas ?? [...BI_ABAS_KEYS]
    const next = checked ? [...new Set([...atual, key])] : atual.filter(k => k !== key)
    const toSave = next.length === BI_ABAS.length ? null : next
    setList(prev => prev.map(x => x.id === u.id ? { ...x, bi_abas: toSave } : x))
    startTransition(async () => { await updateUserBiAbas(u.id, toSave) })
  }

  function toggleModulo(u: UserProfile, key: string, checked: boolean) {
    const atual = u.modulos ?? [...MODULOS_KEYS]
    const next = checked ? [...new Set([...atual, key])] : atual.filter(k => k !== key)
    const toSave = next.length === MODULOS.length ? null : next
    setList(prev => prev.map(x => x.id === u.id ? { ...x, modulos: toSave } : x))
    startTransition(async () => { await updateUserModulos(u.id, toSave) })
  }

  const pending  = list.filter(u => !u.approved)
  const approved = list.filter(u => u.approved)

  function handleApprove(userId: string, role: UserProfile['role']) {
    startTransition(async () => {
      const res = await approveUser(userId, role)
      if (!res.error) setList(prev => prev.map(u => u.id === userId ? { ...u, approved: true, role } : u))
    })
  }

  function handleRole(userId: string, role: UserProfile['role']) {
    startTransition(async () => {
      const res = await updateUserRole(userId, role)
      if (!res.error) setList(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    })
  }

  function handleRevoke(userId: string) {
    if (!confirm('Revogar acesso deste usuário?')) return
    startTransition(async () => {
      const res = await revokeUser(userId)
      if (!res.error) setList(prev => prev.map(u => u.id === userId ? { ...u, approved: false } : u))
    })
  }

  function salvarSetor(u: UserProfile) {
    const s = (editSetor[u.id] ?? u.setor ?? '').trim() || null
    setList(prev => prev.map(x => x.id === u.id ? { ...x, setor: s } : x))
    startTransition(async () => { await updateUserSetor(u.id, s) })
  }

  function salvarTelegram(u: UserProfile) {
    const t = (editTg[u.id] ?? u.telegram_chat_id ?? '').trim() || null
    setList(prev => prev.map(x => x.id === u.id ? { ...x, telegram_chat_id: t } : x))
    startTransition(async () => { await updateUserTelegramChatId(u.id, t) })
  }

  function openExtraPanel(userId: string, u: UserProfile) {
    if (openExtra === userId) { setOpenExtra(null); return }
    setEditSetor(prev => ({ ...prev, [userId]: u.setor ?? '' }))
    setEditTg(prev => ({ ...prev, [userId]: u.telegram_chat_id ?? '' }))
    setOpenExtra(userId)
    setOpenAbas(null)
    setOpenModulos(null)
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Pendentes */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <span className="text-sm font-bold" style={{ color: '#92400e' }}>Aguardando aprovação</span>
          {pending.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#f59e0b', color: '#fff' }}>
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhum cadastro pendente</p>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
            {pending.map(u => (
              <div key={u.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{u.email}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                      Solicitado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                    Pendente
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <p className="text-xs w-full mb-1" style={{ color: '#6b7280' }}>Aprovar como:</p>
                  {(['viewer', 'editor', 'admin', 'operador'] as const).map(role => (
                    <button key={role} onClick={() => handleApprove(u.id, role)} disabled={isPending}
                      className="py-2 px-3 rounded text-xs font-semibold border transition-colors disabled:opacity-50"
                      style={{ ...roleColor[role], border: `1px solid ${roleColor[role].border}` }}>
                      {roleLabel[role]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Aprovados */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="px-5 py-3" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <span className="text-sm font-bold" style={{ color: '#1a2a3a' }}>Usuários com acesso</span>
          <span className="text-xs ml-2" style={{ color: '#9ca3af' }}>{approved.length} usuário{approved.length !== 1 ? 's' : ''}</span>
        </div>

        {approved.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#9ca3af' }}>Nenhum usuário aprovado</p>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
            {approved.map(u => {
              const todasAbas   = u.bi_abas == null
              const qtdAbas     = todasAbas ? BI_ABAS.length : u.bi_abas!.length
              const todosModulos = u.modulos == null
              const qtdModulos  = todosModulos ? MODULOS.length : u.modulos!.length
              const podeControlarModulos = u.role !== 'admin' && u.role !== 'operador'
              return (
              <div key={u.id}>
                <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
                    style={{ background: '#1B4F8A' }}>
                    {u.email[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1a2a3a' }}>{u.email}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      desde {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {/* Módulos */}
                  {podeControlarModulos && (
                    <button
                      onClick={() => { setOpenModulos(openModulos === u.id ? null : u.id); setOpenAbas(null) }}
                      className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                      style={{ borderColor: '#cbd5e1', color: '#475569' }}>
                      Módulos: {todosModulos ? 'todos' : qtdModulos}
                    </button>
                  )}

                  {/* Abas BI */}
                  {u.role !== 'admin' && u.role !== 'operador' && (
                    <button
                      onClick={() => { setOpenAbas(openAbas === u.id ? null : u.id); setOpenModulos(null) }}
                      className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                      style={{ borderColor: '#cbd5e1', color: '#475569' }}>
                      Abas BI: {todasAbas ? 'todas' : qtdAbas}
                    </button>
                  )}

                  {/* Papel */}
                  <select
                    value={u.role}
                    onChange={e => handleRole(u.id, e.target.value as UserProfile['role'])}
                    disabled={isPending}
                    className="rounded border text-xs px-2 py-1.5 outline-none font-semibold"
                    style={{ ...roleColor[u.role], borderColor: roleColor[u.role].border }}
                  >
                    <option value="viewer">Visualizador</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                    <option value="operador">Operador</option>
                  </select>

                  {/* Setor / Telegram */}
                  <button
                    onClick={() => openExtraPanel(u.id, u)}
                    className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50"
                    style={{ borderColor: u.setor || u.telegram_chat_id ? '#6ee7b7' : '#cbd5e1', color: u.setor || u.telegram_chat_id ? '#047857' : '#475569' }}>
                    {u.setor ? `Setor: ${u.setor}` : 'Setor / TG'}
                  </button>

                  {/* Redefinir senha */}
                  <button onClick={() => { setResetId(resetId === u.id ? null : u.id); setResetVal(''); setResetMsg(null) }} disabled={isPending}
                    className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-gray-50 disabled:opacity-50"
                    style={{ borderColor: '#cbd5e1', color: '#475569' }}>
                    Senha
                  </button>

                  {/* Revogar */}
                  <button onClick={() => handleRevoke(u.id)} disabled={isPending}
                    className="text-xs px-3 py-1.5 rounded border transition-colors hover:bg-red-50 disabled:opacity-50"
                    style={{ borderColor: '#fecaca', color: '#ef4444' }}>
                    Revogar
                  </button>
                </div>

                {/* Painel Setor + Telegram Chat ID */}
                {openExtra === u.id && (
                  <div className="px-5 pb-4 -mt-1">
                    <div className="rounded-lg p-3" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                      <p className="text-xs font-medium mb-3" style={{ color: '#374151' }}>Restrições de acesso e notificações</p>
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Setor */}
                        <div className="flex-1">
                          <label className="text-xs mb-1 block" style={{ color: '#6b7280' }}>
                            Setor de equipamentos
                            <span className="ml-1" style={{ color: '#9ca3af' }}>(vazio = vê todos)</span>
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={editSetor[u.id] ?? ''}
                              onChange={e => setEditSetor(prev => ({ ...prev, [u.id]: e.target.value }))}
                              className="flex-1 rounded border px-2 py-1.5 text-sm outline-none"
                              style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}
                            >
                              <option value="">Sem restrição (vê todos)</option>
                              {setores.map(s => (
                                <option key={s.id} value={s.nome}>{s.nome}</option>
                              ))}
                            </select>
                            <button onClick={() => salvarSetor(u)} disabled={isPending}
                              className="text-xs font-semibold px-3 py-1.5 rounded text-white disabled:opacity-50"
                              style={{ background: '#1B4F8A' }}>
                              Salvar
                            </button>
                          </div>
                          {setores.length === 0 && (
                            <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>Cadastre setores em Cadastros para usar esta opção.</p>
                          )}
                        </div>
                        {/* Telegram Chat ID */}
                        <div className="flex-1">
                          <label className="text-xs mb-1 block" style={{ color: '#6b7280' }}>
                            Telegram Chat ID
                            <span className="ml-1" style={{ color: '#9ca3af' }}>(para alertas de máquinas)</span>
                          </label>
                          <div className="flex gap-2">
                            <input
                              value={editTg[u.id] ?? ''}
                              onChange={e => setEditTg(prev => ({ ...prev, [u.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') salvarTelegram(u) }}
                              placeholder="ex: 123456789 ou -100987…"
                              className="flex-1 rounded border px-2 py-1.5 text-sm outline-none"
                              style={{ borderColor: '#d1d5db', color: '#1a2a3a' }}
                            />
                            <button onClick={() => salvarTelegram(u)} disabled={isPending}
                              className="text-xs font-semibold px-3 py-1.5 rounded text-white disabled:opacity-50"
                              style={{ background: '#1B4F8A' }}>
                              Salvar
                            </button>
                          </div>
                        </div>
                      </div>
                      {u.setor && (
                        <p className="text-xs mt-2" style={{ color: '#047857' }}>
                          Este usuário vê apenas equipamentos do setor <strong>{u.setor}</strong>.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Painel de redefinir senha */}
                {resetId === u.id && (
                  <div className="px-5 pb-4 -mt-1">
                    <div className="rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                      <span className="text-xs" style={{ color: '#6b7280' }}>Nova senha provisória:</span>
                      <input value={resetVal} onChange={e => setResetVal(e.target.value)} placeholder="mín. 6 caracteres"
                        className="rounded border px-2 py-1.5 text-sm outline-none" style={{ borderColor: '#d1d5db', color: '#1a2a3a' }} />
                      <button onClick={() => handleReset(u.id)} disabled={isPending}
                        className="text-xs font-semibold px-3 py-1.5 rounded text-white disabled:opacity-50" style={{ background: '#1B4F8A' }}>Redefinir</button>
                      <button onClick={() => setResetId(null)} className="text-xs px-2 py-1.5" style={{ color: '#6b7280' }}>Cancelar</button>
                    </div>
                  </div>
                )}
                {resetMsg?.id === u.id && (
                  <div className="px-5 pb-3 -mt-1">
                    <p className="text-xs px-3 py-2 rounded" style={{ background: resetMsg.ok ? '#ecfdf5' : '#fef2f2', color: resetMsg.ok ? '#047857' : '#b91c1c' }}>{resetMsg.txt}</p>
                  </div>
                )}

                {/* Painel de módulos */}
                {openModulos === u.id && podeControlarModulos && (
                  <div className="px-5 pb-4 -mt-1">
                    <div className="rounded-lg p-3" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                      <p className="text-xs mb-2 font-medium" style={{ color: '#374151' }}>Módulos que este usuário pode acessar:</p>
                      <div className="space-y-2">
                        {MODULOS.map(mod => {
                          const checked = u.modulos == null || u.modulos.includes(mod.key)
                          return (
                            <label key={mod.key} className="flex items-start gap-2 cursor-pointer">
                              <input type="checkbox" checked={checked} disabled={isPending}
                                onChange={e => toggleModulo(u, mod.key, e.target.checked)}
                                className="mt-0.5" />
                              <span>
                                <span className="text-xs font-medium" style={{ color: '#111827' }}>{mod.label}</span>
                                <span className="text-xs ml-1.5" style={{ color: '#9ca3af' }}>{mod.descricao}</span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Painel de abas do BI */}
                {openAbas === u.id && u.role !== 'admin' && u.role !== 'operador' && (
                  <div className="px-5 pb-4 -mt-1">
                    <div className="rounded-lg p-3" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                      <p className="text-xs mb-2" style={{ color: '#6b7280' }}>Abas do BI que este usuário pode ver:</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {BI_ABAS.map(aba => {
                          const checked = u.bi_abas == null || u.bi_abas.includes(aba.key)
                          return (
                            <label key={aba.key} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#374151' }}>
                              <input type="checkbox" checked={checked} disabled={isPending}
                                onChange={e => toggleAba(u, aba.key, e.target.checked)} />
                              {aba.label}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="rounded-xl p-4" style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}>
        <p className="text-xs font-semibold mb-2" style={{ color: '#6b7280' }}>PERMISSÕES POR PAPEL</p>
        <div className="space-y-1.5 text-xs" style={{ color: '#374151' }}>
          <p><strong style={{ color: '#92400e' }}>Admin:</strong> aprovação de usuários + acesso total a todos os módulos</p>
          <p><strong style={{ color: '#1d4ed8' }}>Editor:</strong> adicionar, editar e excluir containers — módulos configuráveis</p>
          <p><strong style={{ color: '#6b7280' }}>Visualizador:</strong> somente consulta — módulos configuráveis</p>
          <p><strong style={{ color: '#047857' }}>Operador:</strong> vê apenas o Checklist de empilhadeira</p>
        </div>
        <p className="text-xs mt-3 pt-3" style={{ color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
          Use <strong>Módulos</strong> para restringir quais seções do app cada usuário vê. Use <strong>Abas BI</strong> para filtrar as abas dentro do BI Depot.
          Use <strong>Setor / TG</strong> para tornar um usuário ADM de setor (vê só as máquinas daquele setor) e configurar o Chat ID do Telegram para receber alertas automáticos das máquinas.
        </p>
      </div>
    </div>
  )
}
