'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { approveDespachaTask } from '@/app/actions'
import type { DespachaTask, DespachaProvider, DespachaUrgency } from '@/lib/despacha/types'

const urgencyLabel: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' }
const urgencyColor: Record<string, { bg: string; color: string; border: string }> = {
  critica: { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
  alta:    { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  media:   { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  baixa:   { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
}

function dataHora(s: string) {
  return new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function contarFotos(photos: string | null): number {
  if (!photos) return 0
  try { return Array.isArray(JSON.parse(photos)) ? JSON.parse(photos).length : 0 }
  catch { return 0 }
}

function NovaSolicitacaoItem({ t, providers, aprovar, isPending }: {
  t: DespachaTask
  providers: DespachaProvider[]
  aprovar: (taskId: string, providerId: string | null, urgency: DespachaUrgency) => void
  isPending: boolean
}) {
  const [urgencia,  setUrgencia]  = useState<DespachaUrgency>(t.urgency)
  const [prestador, setPrestador] = useState<string>(t.assignee_id ?? '')
  const fotos = contarFotos(t.photos)
  const uc = urgencyColor[urgencia]

  return (
    <div className="bg-white rounded-lg p-3" style={{ border: '1px solid #fca5a5' }}>
      {/* Dados da solicitação */}
      <div className="mb-3">
        <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{t.title}</p>
        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
          {t.requester}{t.requester_phone ? ` · ${t.requester_phone}` : ''}
          {t.requester_sector ? ` · ${t.requester_sector}` : ''}
          {t.sector ? ` · 📍 ${t.sector}` : ''}
          {t.category ? ` · ${t.category}` : ''}
        </p>
        <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(t.created_at)}{fotos > 0 ? ` · 📷 ${fotos} foto(s)` : ''}</p>
        {t.description && <p className="text-xs mt-1" style={{ color: '#374151' }}>{t.description}</p>}
      </div>
      {/* Ações */}
      <div className="flex flex-wrap items-end gap-2 pt-2" style={{ borderTop: '1px solid #fecaca' }}>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase" style={{ color: '#b91c1c' }}>Criticidade</span>
          <select
            value={urgencia}
            onChange={e => setUrgencia(e.target.value as DespachaUrgency)}
            disabled={isPending}
            className="rounded border text-xs px-2 py-1.5 outline-none font-bold disabled:opacity-50"
            style={{ ...uc, borderColor: uc.border, minWidth: 100 }}
          >
            <option value="critica">🚨 Crítica</option>
            <option value="alta">🔴 Alta</option>
            <option value="media">🟡 Média</option>
            <option value="baixa">🟢 Baixa</option>
          </select>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase" style={{ color: '#b91c1c' }}>Prestador</span>
          <select
            value={prestador}
            onChange={e => setPrestador(e.target.value)}
            disabled={isPending}
            className="rounded border text-xs px-2 py-1.5 outline-none font-semibold disabled:opacity-50"
            style={{ borderColor: '#fca5a5', color: '#374151', minWidth: 160 }}
          >
            <option value="">Atribuir prestador…</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button
          onClick={() => aprovar(t.id, prestador || null, urgencia)}
          disabled={isPending}
          className="rounded-lg text-sm px-4 py-1.5 font-bold disabled:opacity-50"
          style={{ background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          ✓ Aprovar
        </button>
      </div>
    </div>
  )
}

export function AlertaTarefas({ urgentes, atrasadas, preview, novasSolicitacoes, providers }: {
  urgentes: number
  atrasadas: number
  preview: DespachaTask[]
  novasSolicitacoes: DespachaTask[]
  providers: DespachaProvider[]
}) {
  const [aberto, setAberto] = useState(false)
  const [lista, setLista] = useState(novasSolicitacoes)
  const [erro, setErro] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // re-sincroniza com o servidor (LiveRefresh)
  useEffect(() => { setLista(novasSolicitacoes) }, [novasSolicitacoes])

  if (!urgentes && !atrasadas && !lista.length) return null

  function aprovar(taskId: string, providerId: string | null, urgency: DespachaUrgency) {
    setErro(null)
    startTransition(async () => {
      const res = await approveDespachaTask(taskId, providerId ?? undefined, urgency)
      if (res.error) setErro(res.error)
      else setLista(prev => prev.filter(t => t.id !== taskId))
    })
  }

  return (
    <>
      {/* Urgente: nova solicitação via QR Code — sempre visível, sem colapsar (mesmo estilo de "máquina parada") */}
      {lista.length > 0 && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '2px solid #dc2626', background: '#fef2f2', boxShadow: '0 0 0 3px rgba(220,38,38,0.15)' }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ background: '#dc2626' }}>
            <span className="text-lg">📋</span>
            <span className="text-sm font-bold text-white">
              {lista.length} nova(s) solicitação(ões) via QR Code — atribua um prestador
            </span>
          </div>
          <div className="p-4 space-y-3">
            {erro && <p className="text-xs px-3 py-2 rounded" style={{ background: '#fee2e2', color: '#b91c1c' }}>{erro}</p>}
            {lista.map(t => <NovaSolicitacaoItem key={t.id} t={t} providers={providers} aprovar={aprovar} isPending={isPending} />)}
          </div>
        </div>
      )}

      {/* Tarefas atrasadas — sempre visível, sem colapsar */}
      {atrasadas > 0 && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '2px solid #dc2626', background: '#fef2f2', boxShadow: '0 0 0 3px rgba(220,38,38,0.15)' }}>
          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: '#dc2626' }}>
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <span className="text-lg">⏰</span>
              {atrasadas} tarefa(s) ATRASADA(S) no DespachaApp
            </span>
            <Link href="/tarefas" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white whitespace-nowrap" style={{ color: '#b91c1c' }}>
              Abrir Tarefas →
            </Link>
          </div>
        </div>
      )}

      {/* Tarefas urgentes ainda pendentes — colapsável */}
      {urgentes > 0 && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ border: '1px solid #fecaca', background: '#fff7ed' }}>
          <button onClick={() => setAberto(o => !o)} className="w-full px-4 py-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-bold" style={{ color: '#92400e' }}>
              <span className="text-lg">⚠️</span>
              {urgentes} tarefa(s) urgente(s) pendente(s) no DespachaApp
            </span>
            <span className="text-xs font-semibold" style={{ color: '#92400e' }}>{aberto ? 'ocultar' : 'ver'}</span>
          </button>
          {aberto && (
            <div className="px-4 pb-4 space-y-2">
              {preview.map(t => (
                <div key={t.id} className="bg-white rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap" style={{ border: '1px solid #fecaca' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1a2a3a' }}>{t.title}</p>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>
                      {t.requester}{t.sector ? ` · ${t.sector}` : ''} · urgência {urgencyLabel[t.urgency] ?? t.urgency}
                    </p>
                  </div>
                </div>
              ))}
              <Link href="/tarefas?status=pendente" className="inline-block text-xs font-semibold px-3 py-1.5 rounded-lg border" style={{ borderColor: '#fecaca', color: '#b91c1c', background: '#fff' }}>
                Ver todas no DespachaApp →
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  )
}
