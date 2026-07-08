import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TG_TOKEN = process.env.TELEGRAM_TOKEN ?? ''

async function reply(chatId: string | number, text: string) {
  if (!TG_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message = body?.message
    if (!message) return NextResponse.json({ ok: true })

    const chatId   = String(message.chat.id)
    const text     = (message.text ?? '').trim()
    const username = message.from?.username ?? null
    const nome     = message.from?.first_name ?? username ?? 'Usuário'

    const supabase = createAdminClient()

    if (text.startsWith('/start')) {
      await supabase
        .from('telegram_subscriptions')
        .upsert({ chat_id: chatId, username, nome, ativo: true }, { onConflict: 'chat_id' })

      await reply(chatId,
        `✅ <b>Inscrito com sucesso!</b>\n\n` +
        `Olá, ${nome}! Você vai receber alertas sobre:\n` +
        `🌊 <b>Barragens SC</b> — Sul Ituporanga, Oeste Taió, Norte José Boiteux\n` +
        `⚓ <b>Barra do Rio Itajaí</b> — condições de navegação\n\n` +
        `Envie /parar a qualquer momento para cancelar.`
      )
    } else if (text === '/parar' || text === '/stop') {
      await supabase
        .from('telegram_subscriptions')
        .update({ ativo: false })
        .eq('chat_id', chatId)

      await reply(chatId,
        `❌ Inscrição cancelada. Você não receberá mais alertas.\n\nEnvie /start para reativar.`
      )
    } else if (text === '/status') {
      const { data } = await supabase
        .from('barragens_monitoramento')
        .select('nome, nivel_m, capacidade_pct, status, hora_leitura')
        .order('nome')

      if (!data || data.length === 0) {
        await reply(chatId, '⚪ Sem dados disponíveis no momento.')
      } else {
        const emoji = (s: string) => s === 'emergencia' ? '🔴' : s === 'alerta' ? '🟠' : s === 'atencao' ? '🟡' : '🟢'
        const label = (s: string) => s === 'emergencia' ? 'CRÍTICA' : s === 'alerta' ? 'ALERTA' : s === 'atencao' ? 'ATENÇÃO' : 'Normal'
        let msg = `📊 <b>Status atual das barragens</b>\n\n`
        for (const p of data) {
          msg += `${emoji(p.status)} <b>${p.nome}</b> — ${label(p.status)}\n`
          if (p.nivel_m)        msg += `  Nível: ${p.nivel_m} m\n`
          if (p.capacidade_pct) msg += `  Capacidade: ${p.capacidade_pct}%\n`
          msg += '\n'
        }
        await reply(chatId, msg)
      }
    } else {
      await reply(chatId,
        `Comandos disponíveis:\n/start — inscrever-se nos alertas\n/status — ver situação atual das barragens\n/parar — cancelar inscrição`
      )
    }
  } catch (err) {
    console.error('[telegram-webhook]', err)
  }

  return NextResponse.json({ ok: true })
}
