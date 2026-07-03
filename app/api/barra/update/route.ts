import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SITE = 'https://praticoszp21.com.br/'

type CondBarra = {
  condicao_barra?: string
  desc_condicao_barra?: string
  restricao?: string
  menor_profundidade?: string
  mare_atual?: string
}

function formatarStatus(item: CondBarra): string {
  const desc = (item.desc_condicao_barra ?? '').trim()
  const prof = (item.menor_profundidade ?? '').trim()
  const mare = (item.mare_atual ?? '').trim()
  return [desc, prof ? `Prof: ${prof}` : '', mare ? `Maré: ${mare}m` : ''].filter(Boolean).join(' · ')
}

function emojiStatus(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('fechad')) return '🔴'
  if (s.includes('restri')) return '🟡'
  if (s.includes('praticáv') || s.includes('praticav')) return '🟢'
  if (s.includes('condicion')) return '🟠'
  return '⚓'
}

async function sendTelegram(token: string, chats: string[], msg: string) {
  for (const chat of chats) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg }),
    }).catch(e => console.warn(`[barra] telegram erro ${chat}:`, e))
  }
}

export async function GET(req: Request) {
  // Aceita autenticação via header (Vercel Cron) OU query param ?secret= (cron-job.org)
  const authHeader = req.headers.get('authorization')
  const { searchParams } = new URL(req.url)
  const querySecret = searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const validHeader = authHeader === `Bearer ${cronSecret}`
    const validQuery = querySecret === cronSecret
    if (!validHeader && !validQuery) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  try {
    // ── Buscar página e extrair cond_barra ──
    const html = await fetch(SITE, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ALSBot/1.0)' },
      next: { revalidate: 0 },
    }).then(r => r.text())

    const match = html.match(/cond_barra\s*=\s*(\[[\s\S]*?\]);/)
    if (!match) {
      console.warn('[barra] cond_barra não encontrada no HTML')
      return NextResponse.json({ ok: false, msg: 'cond_barra não encontrada' })
    }

    const data = JSON.parse(match[1]) as CondBarra[]
    const item = data[0]
    if (!item) return NextResponse.json({ ok: false, msg: 'array vazio' })

    const profundidade = formatarStatus(item)
    const rawText = match[1].slice(0, 500)
    console.log('[barra] extraído:', profundidade)

    // ── Comparar com o banco ──
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: atual } = await supabase
      .from('barra_status')
      .select('profundidade, changed_em, anterior')
      .eq('id', 1)
      .single()

    const anteriorDB = (atual?.profundidade ?? '') as string
    const changed = profundidade !== anteriorDB

    const now = new Date().toISOString()
    await supabase.from('barra_status').upsert({
      id: 1,
      profundidade,
      raw_text: rawText,
      atualizado_em: now,
      anterior: changed ? anteriorDB : ((atual as Record<string, unknown> | null)?.anterior ?? ''),
      changed_em: changed ? now : ((atual as Record<string, unknown> | null)?.changed_em ?? null),
    }, { onConflict: 'id' })

    if (changed) {
      const token = process.env.TELEGRAM_TOKEN ?? ''
      const chats = (process.env.TELEGRAM_BARRA_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || '')
        .split(',').map(s => s.trim()).filter(Boolean)
      if (token && chats.length > 0) {
        const horaBrasilia = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        const anterior = anteriorDB.includes('cond_barra') ? '(formato anterior)' : anteriorDB || '(sem registro)'
        const emoji = emojiStatus(profundidade)
        const emojiAnterior = anteriorDB && !anteriorDB.includes('cond_barra') ? emojiStatus(anteriorDB) : '⚓'
        const msg =
          `🚢 BARRA ITAJAÍ — condição atualizada\n\n` +
          `${emojiAnterior} Anterior: ${anterior}\n` +
          `${emoji} Atual: ${profundidade}\n\n` +
          `📅 ${horaBrasilia} BRT\n🔗 ${SITE}`
        await sendTelegram(token, chats, msg)
      }
      console.log('[barra] mudança detectada:', anteriorDB, '→', profundidade)
    }

    return NextResponse.json({ ok: true, profundidade, changed })
  } catch (e) {
    console.error('[barra] erro:', e)
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
