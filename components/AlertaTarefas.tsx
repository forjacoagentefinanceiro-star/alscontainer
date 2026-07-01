'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { updateDespachaTaskAssignee } from '@/app/actions'
import type { DespachaTask, DespachaProvider } from '@/lib/despacha/types'

const urgencyLabel: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' }

function dataHora(s: string) {
  return new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function contarFotos(photos: string | null): number {
  if (!photos) return 0
  try {
    const arr = JSON.parse(photos)
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

function NovaSolicitacaoItem({ t, providers, atribuir, isPending }: {
  t: DespachaTask
  providers: DespachaProvider[]
  atribuir: (taskId: string, providerId: string) => void
  isPending: boolean
}) {
  const fotos = contarFotos(t.photos)
  return (
    <div className="bg-white rounded-lg p-3 flex items-start justify-between gap-3 flex-wrap" style={{ border: '1px solid #fca5a5' }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: '#1a2a3a' }}>{t.title}</p>
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          {t.requester}{t.requester_phone ? ` · ${t.requester_phone}` : ''}{t.client_address ? ` · ${t.client_address}` : ''}
        </p>
        <p className="text-xs" style={{ color: '#9ca3af' }}>{dataHora(t.created_at)}{fotos > 0 ? ` · 📷 ${fotos} foto(s)` : ''}</p>
        {t.description && <p className="text-xs mt-1" style={{ color: '#374151' }}>{t.description}</p>}
      </div>
      <div className="shrink-0">
        <select
          defaultValue=""
          disabled={isPending}
          onChange={e => { if (e.target.value) atribuir(t.id, e.target.value) }}
          className="rounded border text-xs px-2 py-1.5 outline-none font-semibold disabled:opacity-50"
          style={{ borderColor: '#fca5a5', color: '#b91c1c' }}
        >
          <option value="" disabled>Atribuir prestador…</option>
          {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
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

  function atribuir(taskId: string, providerId: string) {
    setErro(null)
    startTransition(async () => {
      const res = await updateDespachaTaskAssignee(taskId, providerId)
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
            {lista.map(t => <NovaSolicitacaoItem key={t.id} t={t} providers={providers} atribuir={atribuir} isPending={isPending} />)}
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
