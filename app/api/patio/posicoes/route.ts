import { createClient } from '@/lib/supabase/server'
import { getMyProfile } from '@/app/actions'
import { temModulo } from '@/lib/modulos'

export const dynamic = 'force-dynamic'

const ARMADORES = ['maersk', 'hapag', 'evergreen', 'login', 'one', 'valle', 'cheio', 'livre', 'oficina']
const SITUACOES = ['AV', 'OK', 'SOF', 'SAINDO', 'VENDA', 'DESCARGA', 'CHEIO', 'VAZIO', 'OFICINA', 'LIVRE', 'NA']
const PILHAS = ['completa', 'parcial', 'vazia']

async function autorizado() {
  const profile = await getMyProfile()
  return profile && profile.approved && temModulo(profile.role, profile.modulos, 'patio') ? profile : null
}

// Estado atual de todas as posições alteradas pelo pátio
export async function GET() {
  if (!(await autorizado())) return Response.json({ error: 'Sem acesso ao Mapa do Pátio' }, { status: 403 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patio_posicoes')
    .select('chave, armador, situacao, pilha, qtd, obs, atualizado_email, atualizado_em')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ posicoes: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

// Altera uma posição e registra no histórico
export async function POST(req: Request) {
  const profile = await autorizado()
  if (!profile) return Response.json({ error: 'Sem acesso ao Mapa do Pátio' }, { status: 403 })

  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const chave = typeof b?.chave === 'string' ? b.chave.trim() : ''
  const armador = String(b?.armador ?? '')
  const situacao = String(b?.situacao ?? '')
  const pilha = b?.pilha == null || b.pilha === '' ? null : String(b.pilha)
  const qtdRaw = b?.qtd
  const qtd = qtdRaw == null || qtdRaw === '' ? null : Number(qtdRaw)
  const obs = typeof b?.obs === 'string' && b.obs.trim() ? b.obs.trim().slice(0, 200) : null

  if (!/^R\d+ .+\|.+$/.test(chave) || chave.length > 60) return Response.json({ error: 'Posição inválida' }, { status: 400 })
  if (!ARMADORES.includes(armador)) return Response.json({ error: 'Armador inválido' }, { status: 400 })
  if (!SITUACOES.includes(situacao)) return Response.json({ error: 'Situação inválida' }, { status: 400 })
  if (pilha != null && !PILHAS.includes(pilha)) return Response.json({ error: 'Pilha inválida' }, { status: 400 })
  if (qtd != null && (!Number.isInteger(qtd) || qtd < 0 || qtd > 999)) return Response.json({ error: 'Quantidade inválida' }, { status: 400 })

  const supabase = await createClient()
  const agora = new Date().toISOString()
  const registro = { chave, armador, situacao, pilha, qtd, obs, atualizado_por: profile.id, atualizado_email: profile.email, atualizado_em: agora }
  const { error } = await supabase.from('patio_posicoes').upsert(registro, { onConflict: 'chave' })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await supabase.from('patio_historico').insert({ chave, armador, situacao, pilha, qtd, obs, usuario: profile.id, usuario_email: profile.email })

  return Response.json({ ok: true, posicao: { chave, armador, situacao, pilha, qtd, obs, atualizado_email: profile.email, atualizado_em: agora } })
}
