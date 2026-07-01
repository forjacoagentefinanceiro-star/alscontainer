'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { DespachaTask, DespachaProvider } from '@/lib/despacha/types'

const DAYS   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const URG_COLOR: Record<string, string> = {
  critica: '#ef4444',
  alta:    '#f97316',
  media:   '#eab308',
  baixa:   '#22c55e',
}
const STA_COLOR: Record<string, string> = {
  pendente:     '#f59e0b',
  em_andamento: '#3b82f6',
  concluida:    '#10b981',
  cancelada:    '#6b7280',
}
const STA_LABEL: Record<string, string> = {
  pendente:     'Pendente',
  em_andamento: 'Em andamento',
  concluida:    'Concluída',
  cancelada:    'Cancelada',
}
const URG_LABEL: Record<string, string> = {
  critica: '🚨 Crítica',
  alta:    '🔴 Alta',
  media:   '🟡 Média',
  baixa:   '🟢 Baixa',
}

function fmtDate(d: string | null) {
  if (!d) return '–'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function AgendaView({
  tasks,
  providers,
  year,
  month,
}: {
  tasks: DespachaTask[]
  providers: DespachaProvider[]
  year: number
  month: number
}) {
  const router  = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const today   = new Date()
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()

  const firstDow   = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrev  = new Date(year, month - 1, 0).getDate()

  const cells: { day: number; cur: boolean }[] = []
  for (let i = firstDow - 1; i >= 0; i--) cells.push({ day: daysInPrev - i, cur: false })
  for (let d = 1; d <= daysInMonth; d++)   cells.push({ day: d, cur: true })
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - firstDow - daysInMonth + 1, cur: false })

  function tasksByDay(d: number) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    return tasks.filter(t => t.due_date === dateStr)
  }

  function navigate(dir: number) {
    let nm = month + dir, ny = year
    if (nm < 1)  { nm = 12; ny-- }
    if (nm > 12) { nm = 1;  ny++ }
    router.push(`/tarefas/agenda?m=${ny}-${String(nm).padStart(2, '0')}`)
  }

  const providerName = (id: string | null) =>
    id ? providers.find(p => p.id === id)?.name ?? '—' : '—'

  const selectedTasks = selected ? tasksByDay(selected) : []

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Agenda de Tarefas</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>
          Visualize as tarefas por prazo de conclusão.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {/* Header de navegação */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
          <h2 className="text-base font-bold" style={{ color: '#1a2a3a' }}>
            {MONTHS[month - 1]} {year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{ background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}
            >
              ‹ Anterior
            </button>
            <button
              onClick={() => router.push('/tarefas/agenda')}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{ background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer' }}
            >
              Hoje
            </button>
            <button
              onClick={() => navigate(1)}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{ background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer' }}
            >
              Próximo ›
            </button>
          </div>
        </div>

        {/* Grade de dias da semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid #f3f4f6' }}>
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-bold py-2 uppercase tracking-wide" style={{ color: '#9ca3af' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Células do calendário */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {cells.map((cell, i) => {
            const dayTasks = cell.cur ? tasksByDay(cell.day) : []
            const active   = selected === cell.day && cell.cur
            return (
              <div
                key={i}
                onClick={() => cell.cur && setSelected(active ? null : cell.day)}
                style={{
                  minHeight: 90,
                  padding: '6px 6px 4px',
                  borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid #f3f4f6',
                  borderBottom: '1px solid #f3f4f6',
                  background: active
                    ? '#eff6ff'
                    : isToday(cell.day) && cell.cur
                    ? '#f0fdf4'
                    : cell.cur ? '#fff' : '#fafafa',
                  cursor: cell.cur ? 'pointer' : 'default',
                  transition: 'background .15s',
                }}
              >
                <div style={{
                  fontSize: '.75rem',
                  fontWeight: isToday(cell.day) && cell.cur ? 700 : 500,
                  color: isToday(cell.day) && cell.cur
                    ? '#fff'
                    : cell.cur ? '#374151' : '#d1d5db',
                  width: 22, height: 22,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday(cell.day) && cell.cur ? '#1B4F8A' : 'transparent',
                  marginBottom: 3,
                }}>
                  {cell.day}
                </div>
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    title={`#${t.id} — ${t.title}`}
                    style={{
                      fontSize: '.6rem',
                      fontWeight: 600,
                      borderRadius: 4,
                      padding: '2px 4px',
                      marginBottom: 2,
                      background: t.status === 'concluida'
                        ? '#d1fae5'
                        : URG_COLOR[t.urgency] + '22',
                      color: t.status === 'concluida'
                        ? '#047857'
                        : URG_COLOR[t.urgency],
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    #{t.id} {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div style={{ fontSize: '.58rem', color: '#9ca3af', paddingLeft: 2 }}>
                    +{dayTasks.length - 3} mais
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Painel do dia selecionado */}
      {selected && (
        <div className="mt-4 rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <h3 className="text-sm font-bold" style={{ color: '#1a2a3a' }}>
              {String(selected).padStart(2, '0')}/{String(month).padStart(2, '0')}/{year} — {selectedTasks.length} tarefa{selectedTasks.length !== 1 ? 's' : ''}
            </h3>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#9ca3af' }}>Nenhuma tarefa neste dia</p>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {selectedTasks.map(t => (
                <div key={t.id} className="px-5 py-3 flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono" style={{ color: '#9ca3af' }}>#{t.id}</span>
                      <p className="text-sm font-semibold truncate" style={{ color: '#1a2a3a' }}>{t.title}</p>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
                      {t.requester}{t.sector ? ` · ${t.sector}` : ''} · {providerName(t.assignee_id)}
                    </p>
                    {t.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: '#374151' }}>{t.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: URG_COLOR[t.urgency] + '22', color: URG_COLOR[t.urgency] }}>
                      {URG_LABEL[t.urgency]}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: STA_COLOR[t.status] + '22', color: STA_COLOR[t.status] }}>
                      {STA_LABEL[t.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap items-center gap-3 px-1">
        <span className="text-xs" style={{ color: '#9ca3af' }}>Urgência:</span>
        {Object.entries(URG_LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-xs" style={{ color: URG_COLOR[k] }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: URG_COLOR[k] + '55', display: 'inline-block' }} />
            {v.replace(/🚨|🔴|🟡|🟢/g, '').trim()}
          </span>
        ))}
        <span className="text-xs ml-3 px-2 py-0.5 rounded" style={{ background: '#d1fae5', color: '#047857', fontSize: '.7rem' }}>
          ✓ Concluída
        </span>
      </div>
    </div>
  )
}
