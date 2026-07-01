'use client'

import { useState, useTransition, useEffect } from 'react'
import { updateDespachaTaskFull, deleteDespachaTask } from '@/app/actions'
import type { DespachaTask, DespachaProvider, DespachaUrgency, DespachaStatus } from '@/lib/despacha/types'

const URG_LABEL: Record<DespachaUrgency, string> = { critica: '🚨 Crítica', alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }
const STA_LABEL: Record<DespachaStatus, string>  = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída', cancelada: 'Cancelada' }
const URG_COLOR: Record<DespachaUrgency, string> = { critica: '#ef4444', alta: '#f97316', media: '#eab308', baixa: '#22c55e' }
const STA_COLOR: Record<DespachaStatus, string>  = { pendente: '#f59e0b', em_andamento: '#3b82f6', concluida: '#10b981', cancelada: '#6b7280' }

function fmtDt(s: string | null) {
  if (!s) return '–'
  return new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}
function fmtDate(s: string | null) {
  if (!s) return '–'
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR')
}

type Props = {
  task: DespachaTask
  providers: DespachaProvider[]
  onClose: () => void
  onUpdated: (t: DespachaTask) => void
  onDeleted: (id: string) => void
}

export function TaskDetailModal({ task: initial, providers, onClose, onUpdated, onDeleted }: Props) {
  const [mode,    setMode]    = useState<'view' | 'edit' | 'delete'>('view')
  const [task,    setTask]    = useState(initial)
  const [erro,    setErro]    = useState<string | null>(null)
  const [saving,  startSave]  = useTransition()

  // form state (edit mode)
  const [f, setF] = useState({
    title:            task.title,
    description:      task.description ?? '',
    requester:        task.requester,
    requester_phone:  task.requester_phone ?? '',
    requester_sector: task.requester_sector ?? '',
    sector:           task.sector ?? '',
    category:         task.category ?? '',
    urgency:          task.urgency,
    status:           task.status,
    assignee_id:      task.assignee_id ?? '',
    due_date:         task.due_date ?? '',
    notes:            task.notes ?? '',
  })

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const providerName = (id: string | null) => id ? (providers.find(p => p.id === id)?.name ?? id) : '–'

  function handleSave() {
    setErro(null)
    startSave(async () => {
      const body: Record<string, unknown> = {
        title:            f.title.trim(),
        description:      f.description.trim() || null,
        requester:        f.requester.trim(),
        requester_phone:  f.requester_phone.trim() || null,
        requester_sector: f.requester_sector.trim() || null,
        sector:           f.sector.trim() || null,
        category:         f.category.trim() || null,
        urgency:          f.urgency,
        status:           f.status,
        assignee_id:      f.assignee_id || null,
        due_date:         f.due_date || null,
        notes:            f.notes.trim() || null,
      }
      const res = await updateDespachaTaskFull(task.id, body)
      if (res.error) { setErro(res.error); return }
      const updated = { ...task, ...body } as DespachaTask
      setTask(updated)
      onUpdated(updated)
      setMode('view')
    })
  }

  function handleDelete() {
    setErro(null)
    startSave(async () => {
      const res = await deleteDespachaTask(task.id)
      if (res.error) { setErro(res.error); return }
      onDeleted(task.id)
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.5)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: '#fff', boxShadow: '0 25px 60px rgba(0,0,0,.25)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0"
          style={{ background: '#fff', borderBottom: '1px solid #f3f4f6', zIndex: 1 }}>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: '#f3f4f6', color: '#6b7280' }}>
              #{task.id}
            </span>
            <h2 className="text-base font-bold truncate" style={{ color: '#1a2a3a', maxWidth: 340 }}>
              {task.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' && (
              <>
                <button onClick={() => { setMode('edit'); setErro(null) }}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer' }}>
                  ✏️ Editar
                </button>
                <button onClick={() => setMode('delete')}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                  🗑 Excluir
                </button>
              </>
            )}
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1.25rem', lineHeight: 1 }}>
              ✕
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          {erro && (
            <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold"
              style={{ background: '#fef2f2', color: '#ef4444' }}>
              {erro}
            </div>
          )}

          {/* ── VIEW MODE ───────────────────────────────────────────────── */}
          {mode === 'view' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: URG_COLOR[task.urgency] + '22', color: URG_COLOR[task.urgency] }}>
                  {URG_LABEL[task.urgency]}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: STA_COLOR[task.status] + '22', color: STA_COLOR[task.status] }}>
                  {STA_LABEL[task.status]}
                </span>
                {task.source === 'publico' && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                    style={{ background: '#f3f4f6', color: '#6b7280' }}>🌐 Pública</span>
                )}
              </div>

              {task.description && (
                <div>
                  <Label>Descrição</Label>
                  <p className="text-sm mt-0.5" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>{task.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Solicitante"    value={task.requester} />
                <Field label="Telefone"       value={task.requester_phone} />
                <Field label="Setor solicitante" value={task.requester_sector} />
                <Field label="Local / Setor"  value={task.sector} />
                <Field label="Categoria"      value={task.category} />
                <Field label="Prestador"      value={providerName(task.assignee_id)} />
                <Field label="Prazo"          value={fmtDate(task.due_date)} />
                <Field label="SLA"            value={fmtDt(task.sla_deadline)} />
                <Field label="Criada em"      value={fmtDt(task.created_at)} />
                <Field label="Iniciada em"    value={fmtDt(task.started_at)} />
                <Field label="Concluída em"   value={fmtDt(task.completed_at)} />
                {task.elapsed_minutes != null && (
                  <Field label="Tempo total" value={
                    task.elapsed_minutes >= 60
                      ? `${Math.floor(task.elapsed_minutes / 60)}h ${task.elapsed_minutes % 60}min`
                      : `${task.elapsed_minutes}min`
                  } />
                )}
              </div>

              {task.notes && (
                <div>
                  <Label>Observações internas</Label>
                  <p className="text-sm mt-0.5" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>{task.notes}</p>
                </div>
              )}

              {/* Fotos */}
              {task.photos && (() => {
                try {
                  const urls: string[] = JSON.parse(task.photos)
                  if (!urls.length) return null
                  return (
                    <div>
                      <Label>Fotos</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {urls.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt={`Foto ${i+1}`}
                              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb' }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                } catch { return null }
              })()}
            </div>
          )}

          {/* ── EDIT MODE ───────────────────────────────────────────────── */}
          {mode === 'edit' && (
            <div className="space-y-4">
              <FormField label="Título *">
                <input className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                  style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                  value={f.title} onChange={e => set('title', e.target.value)} />
              </FormField>

              <FormField label="Descrição">
                <textarea className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-y"
                  style={{ border: '1.5px solid #e5e7eb', color: '#374151', minHeight: 80 }}
                  value={f.description} onChange={e => set('description', e.target.value)} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Solicitante *">
                  <input className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.requester} onChange={e => set('requester', e.target.value)} />
                </FormField>
                <FormField label="Telefone">
                  <input className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.requester_phone} onChange={e => set('requester_phone', e.target.value)} />
                </FormField>
                <FormField label="Setor solicitante">
                  <input className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.requester_sector} onChange={e => set('requester_sector', e.target.value)} />
                </FormField>
                <FormField label="Local / Setor da tarefa">
                  <input className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.sector} onChange={e => set('sector', e.target.value)} />
                </FormField>
                <FormField label="Categoria">
                  <input className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    placeholder="Elétrica, Hidráulica, TI…"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.category} onChange={e => set('category', e.target.value)} />
                </FormField>
                <FormField label="Prazo">
                  <input type="date" className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.due_date} onChange={e => set('due_date', e.target.value)} />
                </FormField>
                <FormField label="Urgência">
                  <select className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.urgency} onChange={e => set('urgency', e.target.value)}>
                    <option value="critica">🚨 Crítica</option>
                    <option value="alta">🔴 Alta</option>
                    <option value="media">🟡 Média</option>
                    <option value="baixa">🟢 Baixa</option>
                  </select>
                </FormField>
                <FormField label="Status">
                  <select className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.status} onChange={e => set('status', e.target.value)}>
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </FormField>
                <FormField label="Prestador">
                  <select className="w-full text-sm px-3 py-2 rounded-lg outline-none"
                    style={{ border: '1.5px solid #e5e7eb', color: '#1a2a3a' }}
                    value={f.assignee_id} onChange={e => set('assignee_id', e.target.value)}>
                    <option value="">Sem prestador</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Observações internas">
                <textarea className="w-full text-sm px-3 py-2 rounded-lg outline-none resize-y"
                  style={{ border: '1.5px solid #e5e7eb', color: '#374151', minHeight: 60 }}
                  value={f.notes} onChange={e => set('notes', e.target.value)} />
              </FormField>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setMode('view'); setErro(null) }}
                  className="text-sm px-4 py-2 rounded-lg font-semibold"
                  style={{ background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !f.title.trim()}
                  className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
                  style={{ background: '#1B4F8A', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {saving ? 'Salvando…' : '✓ Salvar alterações'}
                </button>
              </div>
            </div>
          )}

          {/* ── DELETE CONFIRM ──────────────────────────────────────────── */}
          {mode === 'delete' && (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">🗑</div>
              <p className="text-base font-bold mb-1" style={{ color: '#1a2a3a' }}>
                Excluir tarefa #{task.id}?
              </p>
              <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                &ldquo;{task.title}&rdquo; — esta ação não pode ser desfeita.
              </p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setMode('view')}
                  className="text-sm px-5 py-2 rounded-lg font-semibold"
                  style={{ background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleDelete} disabled={saving}
                  className="text-sm px-5 py-2 rounded-lg font-semibold disabled:opacity-50"
                  style={{ background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer' }}>
                  {saving ? 'Excluindo…' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>{children}</p>
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '–') return (
    <div><Label>{label}</Label><p className="text-sm" style={{ color: '#d1d5db' }}>–</p></div>
  )
  return <div><Label>{label}</Label><p className="text-sm font-medium" style={{ color: '#1a2a3a' }}>{value}</p></div>
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#6b7280' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
