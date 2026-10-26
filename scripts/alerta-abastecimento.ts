/**
 * Verifica máquinas com mais de 18h sem abastecimento e envia alerta no Telegram.
 * Executado via GitHub Actions (ver .github/workflows/alerta-abastecimento.yml).
 */
import { createClient } from '@supabase/supabase-js'

const LIMITE_HORAS = 18
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TG_TOKEN     = process.env.TELEGRAM_TOKEN!
const TG_CHAT      = process.env.TELEGRAM_CHAT_ID!

if (!SUPABASE_URL || !SERVICE_KEY || !TG_TOKEN || !TG_CHAT) {
  console.error('Variáveis de ambiente faltando.')
  process.exit(1)
}

async function tg(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) console.error('Telegram error:', await res.text())
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  // Máquinas ativas com horímetro atual
  const { data: emps } = await sb.from('empilhadeiras')
    .select('nome, horimetro_atual')
    .neq('ativo', false)
  if (!emps?.length) { console.log('Nenhuma empilhadeira ativa.'); return }

  // Último abastecimento por máquina (horimetro mais alto)
  const { data: cks } = await sb.from('checklists').select('id, equipamento')
  const idsMap = new Map<string, string[]>()
  for (const c of cks ?? []) {
    const arr = idsMap.get(c.equipamento as string) ?? []
    arr.push(c.id as string)
    idsMap.set(c.equipamento as string, arr)
  }

  const ultimoAbastH = new Map<string, number>()
  for (const emp of emps) {
    const ids = idsMap.get(emp.nome as string)
    if (!ids?.length) continue
    const { data: evs } = await sb.from('operacao_eventos')
      .select('horimetro')
      .in('checklist_id', ids)
      .not('litros', 'is', null)
      .order('horimetro', { ascending: false })
      .limit(1)
    if (evs?.[0]?.horimetro != null) ultimoAbastH.set(emp.nome as string, Number(evs[0].horimetro))
  }

  const alertas: { nome: string; horas: number; horAtual: number; horAbast: number }[] = []
  for (const emp of emps) {
    const horAtual = Number(emp.horimetro_atual)
    const horAbast = ultimoAbastH.get(emp.nome as string)
    if (horAbast == null || isNaN(horAtual)) continue
    const horas = Math.round((horAtual - horAbast) * 10) / 10
    if (horas >= LIMITE_HORAS) alertas.push({ nome: emp.nome as string, horas, horAtual, horAbast })
  }

  if (!alertas.length) {
    console.log(`Nenhuma máquina acima de ${LIMITE_HORAS}h sem abastecer.`)
    return
  }

  alertas.sort((a, b) => b.horas - a.horas)
  const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  let msg = `⛽ <b>ALERTA — Abastecimento pendente</b>\n\n`
  for (const a of alertas) {
    const emoji = a.horas >= 25 ? '🔴' : '🟠'
    msg += `${emoji} <b>${a.nome}</b> — ${a.horas}h sem abastecer\n`
    msg += `   Horímetro: ${a.horAtual}h | Último abast: ${a.horAbast}h\n\n`
  }
  msg += `Verificado em: ${hora}`

  await tg(msg)
  console.log(`Alerta enviado para ${alertas.length} máquina(s).`)
}

main().catch(e => { console.error(e); process.exit(1) })
