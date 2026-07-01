/**
 * Proxy server-side para a API do DespachaApp.
 * Mantém a X-API-Key no servidor; client components chamam /api/despacha?path=...
 * Cache de 20 segundos para leituras GET.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BASE = process.env.DESPACHA_API_BASE_URL ?? ''
const KEY  = process.env.DESPACHA_API_KEY        ?? ''

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!BASE || !KEY) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const path  = req.nextUrl.searchParams.get('path') ?? ''
  const query = req.nextUrl.searchParams.get('q')    ?? ''
  const url   = `${BASE}${path}${query ? '?' + query : ''}`

  try {
    const res  = await fetch(url, {
      headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
      next: { revalidate: 20 },
    })
    const body = await res.json()
    return NextResponse.json(body, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
