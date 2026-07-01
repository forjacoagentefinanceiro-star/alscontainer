/**
 * Proxy server-side para a API do DespachaApp.
 * Mantém a X-API-Key no servidor; client components chamam /api/despacha?path=...
 *
 * Modo bulk (?bulk=1&q=...): retorna stats + tasks + providers em 1 request.
 * Modo simples (?path=/endpoint&q=...): retorna um endpoint específico.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = process.env.DESPACHA_API_BASE_URL ?? ''
const KEY  = process.env.DESPACHA_API_KEY        ?? ''

function dp(path: string, query?: string) {
  const url = `${BASE}${path}${query ? '?' + query : ''}`
  return fetch(url, {
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
    next: { revalidate: 20 },
  }).then(r => r.json())
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!BASE || !KEY) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  // ── Modo bulk: 1 request do browser, 3 fetches paralelos no servidor ───
  if (req.nextUrl.searchParams.get('bulk') === '1') {
    const tasksQ = req.nextUrl.searchParams.get('q') ?? ''
    try {
      const [stats, tasks, providers] = await Promise.all([
        dp('/stats'),
        dp('/tasks', tasksQ),
        dp('/providers'),
      ])
      return NextResponse.json({ stats, tasks, providers })
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 502 })
    }
  }

  // ── Modo simples: um endpoint específico ───────────────────────────────
  const path  = req.nextUrl.searchParams.get('path') ?? ''
  const query = req.nextUrl.searchParams.get('q')    ?? ''
  try {
    const body = await dp(path, query)
    return NextResponse.json(body)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
