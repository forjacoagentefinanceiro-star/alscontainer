'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TarefasView } from './TarefasView'
import type { DespachaTask, DespachaStats, DespachaProvider, DespachaStatus, DespachaUrgency } from '@/lib/despacha/types'

async function proxyGet<T>(path: string, query?: string): Promise<T | null> {
  try {
    const q = new URLSearchParams({ path })
    if (query) q.set('q', query)
    const res = await fetch(`/api/despacha?${q}`)
    const body = await res.json()
    return body.success ? (body.data as T) : null
  } catch { return null }
}

async function proxyBulk(tasksQ: string): Promise<{
  stats: { success: boolean; data: DespachaStats }
  tasks: { success: boolean; data: DespachaTask[]; total?: number }
  providers: { success: boolean; data: DespachaProvider[] }
} | null> {
  try {
    const q = new URLSearchParams({ bulk: '1', q: tasksQ })
    const res = await fetch(`/api/despacha?${q}`)
    return res.ok ? await res.json() : null
  } catch { return null }
}

export function TarefasClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const filtroStatus  = searchParams.get('status')  as DespachaStatus  | null
  const filtroUrgencia = searchParams.get('urgency') as DespachaUrgency | null

  const [stats,       setStats]       = useState<DespachaStats | null>(null)
  const [tasks,       setTasks]       = useState<DespachaTask[]>([])
  const [total,       setTotal]       = useState(0)
  const [providers,   setProviders]   = useState<DespachaProvider[]>([])
  const [initialized, setInitialized] = useState(false)

  const load = useCallback(async () => {
    const q = new URLSearchParams({ limit: '50' })
    if (filtroStatus)   q.set('status',  filtroStatus)
    if (filtroUrgencia) q.set('urgency', filtroUrgencia)

    const bulk = await proxyBulk(q.toString())
    if (bulk) {
      setStats(bulk.stats.success ? bulk.stats.data : null)
      setTasks(bulk.tasks.success ? bulk.tasks.data : [])
      setTotal(bulk.tasks.success ? (bulk.tasks.total ?? bulk.tasks.data.length) : 0)
      setProviders(bulk.providers.success ? bulk.providers.data : [])
    }
    setInitialized(true)
  }, [filtroStatus, filtroUrgencia])

  useEffect(() => { load() }, [load])

  if (!initialized) {
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Tarefas (DespachaApp)</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Carregando…</p>
        </div>
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-xl h-14 animate-pulse" style={{ background: '#e5e7eb' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <TarefasView
      key={`${filtroStatus ?? ''}-${filtroUrgencia ?? ''}`}
      stats={stats}
      tasks={tasks}
      total={total}
      providers={providers}
      filtroStatus={filtroStatus ?? undefined}
      filtroUrgencia={filtroUrgencia ?? undefined}
    />
  )
}
