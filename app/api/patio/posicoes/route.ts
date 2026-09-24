import { createClient } from '@/lib/supabase/server'
import { getMyProfile } from '@/app/actions'
import { temModulo } from '@/lib/modulos'

export const dynamic = 'force-dynamic'

const ARMADORES = ['maersk', 'hapag', 'evergreen', 'login', 'one', 'valle', 'cheio', 'livre', 'oficina']
const SITUACOES = ['AV', 'OK', 'SOF', 'SAINDO', 'VENDA', 'DESCARGA', 'CHEIO', 'VAZIO', 'OFICINA', 'LIVRE', 'NA']
const PILHAS = ['completa', 'parcial', 'vazia']
// 'R1 D|D4', 'R1 D|D4.A' (lado de 20'), 'R5 E|E1' (pilha nova)
const CHAVE = /^R\d+ [^|]{1,40}\|[^|]{1,12}$/

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
    .select('chave, armador, situacao, pilha, qtd, obs, tamanho, x, y, ang, atualizado_email, atualizado_em')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ posicoes: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

type Linha = {
  chave: string; armador: string; situacao: string; pilha: string | null; qtd: number | null; obs: string | null
  tamanho: '20' | '40' | '20u'; x: number | null; y: number | null; ang: number | null
}

function numOuNull(v: unknown, min: number, max: number): number | null | undefined {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 10) / 10 : undefined
}

function validar(b: Record<string, unknown>): Linha | string {
  const chave = typeof b.chave === 'string' ? b.chave.trim() : ''
  if (!CHAVE.test(chave)) return 'Posição inválida'
  const armador = String(b.armador ?? '')
  const situacao = String(b.situacao ?? '')
  const pilha = b.pilha == null || b.pilha === '' ? null : String(b.pilha)
  // 40' | 2 × 20' (lados A/B) | 1 × 20' (posição que só cabe uma de 20')
  const tamanho = b.tamanho === '20' ? '20' : b.tamanho === '20u' ? '20u' : '40'
  const qtd = numOuNull(b.qtd, 0, 999)
  const x = numOuNull(b.x, 0, 1024), y = numOuNull(b.y, -60, 628), ang = numOuNull(b.ang, -360, 360)
  if (!ARMADORES.includes(armador)) return 'Armador inválido'
  if (!SITUACOES.includes(situacao)) return 'Situação inválida'
  if (pilha != null && !PILHAS.includes(pilha)) return 'Pilha inválida'
  if (qtd === undefined || (qtd != null && !Number.isInteger(qtd))) return 'Quantidade inválida'
  if (x === undefined || y === undefined || ang === undefined || (x == null) !== (y == null)) return 'Posição no mapa inválida'
  const obs = typeof b.obs === 'string' && b.obs.trim() ? b.obs.trim().slice(0, 200) : null
  return { chave, armador, situacao, pilha, qtd, obs, tamanho, x, y, ang }
}

// Altera posições (até 3 de uma vez: pilha + lados A/B) e/ou remove (juntar 20'→40', apagar pilha nova)
export async function POST(req: Request) {
  const profile = await autorizado()
  if (!profile) return Response.json({ error: 'Sem acesso ao Mapa do Pátio' }, { status: 403 })

  const b = await req.json().catch(() => null) as { rows?: unknown; remover?: unknown } | null
  const rowsIn = Array.isArray(b?.rows) ? b.rows : []
  const remover = Array.isArray(b?.remover) ? b.remover.filter((c): c is string => typeof c === 'string' && CHAVE.test(c)) : []
  if (!rowsIn.length && !remover.length) return Response.json({ error: 'Nada para salvar' }, { status: 400 })
  if (rowsIn.length > 3 || remover.length > 3) return Response.json({ error: 'Alterações demais de uma vez' }, { status: 400 })

  const rows: Linha[] = []
  for (const r of rowsIn) {
    const v = validar((r ?? {}) as Record<string, unknown>)
    if (typeof v === 'string') return Response.json({ error: v }, { status: 400 })
    rows.push(v)
  }

  const supabase = await createClient()
  const agora = new Date().toISOString()

  // estado anterior, para a auditoria mostrar antes → depois
  const CAMPOS = 'chave, armador, situacao, pilha, qtd, obs, tamanho, x, y, ang'
  const { data: atuais } = await supabase.from('patio_posicoes').select(CAMPOS).in('chave', [...rows.map(r => r.chave), ...remover])
  const antesPor = new Map((atuais ?? []).map(a => [a.chave as string, a as Record<string, unknown>]))

  if (rows.length) {
    const { error } = await supabase.from('patio_posicoes').upsert(
      rows.map(r => ({ ...r, atualizado_por: profile.id, atualizado_email: profile.email, atualizado_em: agora })),
      { onConflict: 'chave' },
    )
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }
  if (remover.length) {
    const { error } = await supabase.from('patio_posicoes').delete().in('chave', remover)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  const soLugarMudou = (a: Record<string, unknown>, r: Linha) =>
    (['armador', 'situacao', 'pilha', 'qtd', 'obs', 'tamanho'] as const).every(k => (a[k] ?? null) === (r[k] ?? null))
  const historico = [
    ...rows.map(r => {
      const antes = antesPor.get(r.chave) ?? null
      const acao = !antes ? (r.x != null ? 'criou' : 'alterou') : soLugarMudou(antes, r) ? 'moveu' : 'alterou'
      const { chave, ...depois } = r
      return { chave, armador: r.armador, situacao: r.situacao, pilha: r.pilha, qtd: r.qtd, obs: r.obs, tamanho: r.tamanho, acao, antes, depois, usuario: profile.id, usuario_email: profile.email }
    }),
    // só registra remoção do que existia (juntar 20'→40' manda remover lados que podem não existir)
    ...remover.filter(chave => antesPor.has(chave)).map(chave => ({ chave, acao: 'removeu', antes: antesPor.get(chave), depois: null, usuario: profile.id, usuario_email: profile.email })),
  ]
  if (historico.length) {
    let { error } = await supabase.from('patio_historico').insert(historico)
    // banco sem as colunas antes/depois (migration 20260924d ainda não rodada): grava sem elas para não perder o registro
    if (error) ({ error } = await supabase.from('patio_historico').insert(historico.map(h => { const s: Record<string, unknown> = { ...h }; delete s.antes; delete s.depois; return s })))
    if (error) console.error('[patio historico]', error.message)
  }

  return Response.json({ ok: true })
}
