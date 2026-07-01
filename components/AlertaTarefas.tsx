'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { DespachaTask } from '@/lib/despacha/types'

const urgencyLabel: Record<string, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' }

export function AlertaTarefas({ urgentes, atrasadas, preview }: { urgentes: number; atrasadas: number; preview: DespachaTask[] }) {
  const [aberto, setAberto] = useState(false)

  if (!urgentes && !atrasadas) return null

  return (
    <>
      {/* Urgente: tarefas atrasadas — sempre visível, sem colapsar */}
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
