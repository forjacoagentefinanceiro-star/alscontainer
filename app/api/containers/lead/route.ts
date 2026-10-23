import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Endpoint PÚBLICO da página /containers. Recebe:
//  - cliques em "Chamar no WhatsApp" (agora com nome e telefone; sem telefone não cria lead)
//  - nome/telefone enquanto a pessoa preenche (parcial) e no envio do formulário (final)
// Cria ou atualiza o lead no CRM de vendas, já com canal e campanha (utm do anúncio).

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

  if (cortar(b.site, 5)) return NextResponse.json({ ok: true })           // honeypot: robô preencheu o campo escondido

  const ref = cortar(b.ref, 12).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (ref.length < 4) return NextResponse.json({ ok: false, erro: 'ref' }, { status: 400 })
  const nome = cortar(b.nome, 80)
  const digitos = cortar(b.telefone, 30).replace(/\D/g, '')
  const telefone = digitos.length >= 10 && digitos.length <= 13 ? digitos : ''
  const final = b.final === true

  const source = cortar(b.utm_source, 60), medium = cortar(b.utm_medium, 60)
  const campanha = cortar(b.utm_campaign, 80), conteudo = cortar(b.utm_content, 80)
  const click = cortar(b.fbclid, 6) ? 'fbclid' : cortar(b.ttclid, 6) ? 'ttclid' : ''

  let supabase
  try { supabase = createAdminClient() } catch { return NextResponse.json({ ok: false, erro: 'config' }, { status: 503 }) }

  const { data: ja } = await supabase.from('cv_leads').select('id, nome, telefone').like('obs', `%ref ${ref}%`).limit(1)
  let existente = ja?.[0]

  // mesmo telefone já em atendimento (outra visita ou requisição simultânea) = mesmo lead, não cria outro
  if (!existente && telefone) {
    const desde = new Date(Date.now() - 30 * 86400_000).toISOString()
    const { data: mesmo } = await supabase.from('cv_leads').select('id, nome, telefone')
      .eq('telefone', telefone).not('etapa', 'in', '(vendido,perdido)').gte('criado_em', desde).order('criado_em').limit(1)
    existente = mesmo?.[0]
  }

  // ---------- já existe: completa nome/telefone e registra o envio ----------
  if (existente) {
    const upd: Record<string, unknown> = {}
    if (nome && existente.nome.startsWith('Lead do site')) upd.nome = nome
    else if (nome && nome !== existente.nome) upd.nome = nome
    if (telefone && telefone !== existente.telefone) upd.telefone = telefone
    if (Object.keys(upd).length) {
      upd.atualizado_em = new Date().toISOString()
      await supabase.from('cv_leads').update(upd).eq('id', existente.id)
    }
    if (final) {
      const { data: j } = await supabase.from('cv_atividades').select('id').eq('lead_id', existente.id).like('texto', 'Enviou o formulário%').limit(1)
      if (!j?.length) {
        await supabase.from('cv_atividades').insert({ lead_id: existente.id, tipo: 'nota', texto: 'Enviou o formulário da página (pediu contato).' })
        await supabase.from('cv_tarefas').insert({ lead_id: existente.id, titulo: `Chamar agora: pediu contato pelo formulário${nome ? ` (${nome})` : ''}`, vence_em: new Date(Date.now() + 15 * 60_000).toISOString() })
      }
    } else if (telefone && !existente.telefone) {
      await supabase.from('cv_atividades').insert({ lead_id: existente.id, tipo: 'nota', texto: 'Telefone captado ao preencher o formulário (ainda não enviou).' })
    }
    return NextResponse.json({ ok: true })
  }

  // ---------- novo lead ----------
  if (!telefone) return NextResponse.json({ ok: false, erro: 'telefone' }, { status: 422 })   // lead sem telefone não entra no CRM
  const canal = canalDe(source || (click === 'ttclid' ? 'tiktok' : click === 'fbclid' ? 'facebook' : ''), medium)
  let campanhaId: string | null = null
  if (campanha) {
    const { data: cs } = await supabase.from('cv_campanhas').select('id, nome, utm')
    const alvo = slug(campanha)
    const achada = (cs ?? []).find(c => slug(c.utm ?? '') === alvo || slug(c.nome) === alvo)
    if (achada) campanhaId = achada.id
    else {
      const { data: nova } = await supabase.from('cv_campanhas').insert({ nome: campanha, canal, utm: campanha, verba: 0, ativa: true }).select('id').single()
      campanhaId = nova?.id ?? null
    }
  }

  const origem = [source && `fonte ${source}`, medium && `meio ${medium}`, campanha && `campanha ${campanha}`, conteudo && `anúncio ${conteudo}`, click && `clique ${click}`].filter(Boolean).join(' · ')
  const como = final ? 'Enviou o formulário da página de containers' : telefone ? 'Preencheu o telefone na página de containers (captado antes de enviar)' : 'Clicou em "Chamar no WhatsApp" na página de containers'
  const { data: lead, error } = await supabase.from('cv_leads').insert({
    nome: nome || `Lead do site · ref ${ref}`, telefone: telefone || null, canal, campanha_id: campanhaId,
    obs: `${como}. ref ${ref}${origem ? ` · ${origem}` : ''}.${telefone ? '' : ' Peça o nome e o telefone na conversa e complete o cadastro.'}`,
  }).select('id').single()
  if (error || !lead) return NextResponse.json({ ok: false, erro: 'db' }, { status: 500 })

  await supabase.from('cv_atividades').insert({ lead_id: lead.id, tipo: 'nota', texto: `${como} (ref ${ref})${origem ? ` — ${origem}` : ''}.` })
  await supabase.from('cv_tarefas').insert({
    lead_id: lead.id,
    titulo: telefone ? `Chamar agora: ${nome || 'lead do site'}${final ? '' : ' (não enviou o formulário)'}` : `Responder o lead do site (ref ${ref})`,
    vence_em: new Date(Date.now() + (telefone ? 15 : 60) * 60_000).toISOString(),
  })
  return NextResponse.json({ ok: true })
}
