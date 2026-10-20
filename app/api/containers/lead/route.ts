import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Endpoint PÚBLICO chamado pela página /containers quando alguém clica em "Chamar no WhatsApp".
// Cria o lead no CRM de vendas já com canal e campanha (a partir dos parâmetros utm do anúncio).

const cortar = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function canalDe(source: string, medium: string): string {
  const s = `${source} ${medium}`.toLowerCase()
  if (/tiktok|ttclid/.test(s)) return 'tiktok'
  if (/insta|\big\b/.test(s)) return 'instagram'
  if (/face|\bfb\b|meta/.test(s)) return 'facebook'
  if (/whats|wpp/.test(s)) return 'whatsapp'
  if (/olx/.test(s)) return 'olx'
  return 'site'
}

export async function POST(req: Request) {
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  const ref = cortar(b.ref, 12).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (ref.length < 4) return NextResponse.json({ ok: false, erro: 'ref' }, { status: 400 })
  const source = cortar(b.utm_source, 60), medium = cortar(b.utm_medium, 60)
  const campanha = cortar(b.utm_campaign, 80), conteudo = cortar(b.utm_content, 80)
  const click = cortar(b.fbclid, 6) ? 'fbclid' : cortar(b.ttclid, 6) ? 'ttclid' : ''

  let supabase
  try { supabase = createAdminClient() } catch { return NextResponse.json({ ok: false, erro: 'config' }, { status: 503 }) }

  // 1 lead por ref (cliques repetidos / recarga da página não duplicam)
  const { data: ja } = await supabase.from('cv_leads').select('id').like('obs', `%ref ${ref}%`).limit(1)
  if (ja && ja.length) return NextResponse.json({ ok: true, repetido: true })

  const canal = canalDe(source || (click === 'ttclid' ? 'tiktok' : click === 'fbclid' ? 'facebook' : ''), medium)

  // campanha: casa pelo utm_campaign (ou pelo nome); se ainda não existe, cria para você só informar o gasto
  let campanhaId: string | null = null
  if (campanha) {
    const { data: cs } = await supabase.from('cv_campanhas').select('id, nome, utm')
    const alvo = slug(campanha)
    const achada = (cs ?? []).find(c => slug(c.utm ?? '') === alvo || slug(c.nome) === alvo)
    if (achada) campanhaId = achada.id
    else {
      const { data: nova } = await supabase.from('cv_campanhas')
        .insert({ nome: campanha, canal, utm: campanha, verba: 0, ativa: true }).select('id').single()
      campanhaId = nova?.id ?? null
    }
  }

  const origem = [source && `fonte ${source}`, medium && `meio ${medium}`, campanha && `campanha ${campanha}`, conteudo && `anúncio ${conteudo}`, click && `clique ${click}`].filter(Boolean).join(' · ')
  const { data: lead, error } = await supabase.from('cv_leads').insert({
    nome: `Lead do site · ref ${ref}`, canal, campanha_id: campanhaId,
    obs: `Clicou em "Chamar no WhatsApp" na página de containers. ref ${ref}${origem ? ` · ${origem}` : ''}. Peça o nome e o telefone na conversa e complete o cadastro.`,
  }).select('id').single()
  if (error || !lead) return NextResponse.json({ ok: false, erro: 'db' }, { status: 500 })

  await supabase.from('cv_atividades').insert({ lead_id: lead.id, tipo: 'nota', texto: `Entrou pela página de containers (ref ${ref})${origem ? ` — ${origem}` : ''}.` })
  await supabase.from('cv_tarefas').insert({ lead_id: lead.id, titulo: `Responder o lead do site (ref ${ref})`, vence_em: new Date(Date.now() + 3600_000).toISOString() })
  return NextResponse.json({ ok: true })
}
