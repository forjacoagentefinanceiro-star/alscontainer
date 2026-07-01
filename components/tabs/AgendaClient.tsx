'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { AgendaView } from './AgendaView'
import type { DespachaTask, DespachaProvider } from '@/lib/despacha/types'

async function proxyGet<T>(path: string, query?: string): Promise<T | null> {
  try {
    const q = new URLSearchParams({ path })
    if (query) q.set('q', query)
    const res = await fetch(`/api/despacha?${q}`)
    const body = await res.json()
    return body.success ? (body.data as T) : null
  } catch { return null }
}

export function AgendaClient() {
  const searchParams = useSearchParams()
  const m = searchParams.get('m') ?? ''

  const today = new Date()
  let year  = today.getFullYear()
  let month = today.getMonth() + 1
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-').map(Number)
    year = y; month = mo
  }

  const [tasks,     setTasks]     = useState<DespachaTask[]>([])
  const [providers, setProviders] = useState<DespachaProvider[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    const due_from = `${year}-${String(month).padStart(2,'0')}-01`
    const lastDay  = new Date(year, month, 0).getDate()
    const due_to   = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
    const q = new URLSearchParams({ due_from, due_to, limit: '100' })

    Promise.all([
      proxyGet<DespachaTask[]>('/tasks', q.toString()),
      proxyGet<DespachaProvider[]>('/providers'),
    ]).then(([t, p]) => {
      setTasks(t ?? [])
      setProviders(p ?? [])
      setLoading(false)
    })
  }, [year, month])

  if (loading) {
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Agenda de Tarefas</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Carregando…</p>
        </div>
        <div className="rounded-xl animate-pulse" style={{ background: '#e5e7eb', height: 420 }} />
      </div>
    )
  }

  return (
    <AgendaView
      tasks={tasks}
      providers={providers}
      year={year}
      month={month}
    />
  )
}
