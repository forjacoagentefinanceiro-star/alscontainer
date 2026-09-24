import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyProfile } from '@/app/actions'
import { ARMADOR_NOME, SITUACAO_NOME, PILHA_NOME, TAMANHO_NOME, nomePosicao } from '@/lib/patio/rotulos'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Histórico do Pátio — ALS Depot' }

const POR_PAGINA = 100
const TZ = 'America/Sao_Paulo'

type Estado = { armador?: string | null; situacao?: string | null; pilha?: string | null; qtd?: number | null; obs?: string | null; tamanho?: string | null; x?: number | null; y?: number | null; ang?: number | null }
type Registro = {
  id: number; chave: string; acao: string | null; criado_em: string; usuario_email: string | null
  armador: string | null; situacao: string | null; pilha: string | null; qtd: number | null; obs: string | null; tamanho: string | null
  antes: Estado | null; depois: Estado | null
}

const ACAO: Record<string, { txt: string; cor: string; bg: string }> = {
  criou:   { txt: 'Criou pilha', cor: '#047857', bg: '#ecfdf5' },
  alterou: { txt: 'Alterou',     cor: '#1d4ed8', bg: '#eff6ff' },
  moveu:   { txt: 'Moveu',       cor: '#6d28d9', bg: '#f5f3ff' },
  removeu: { txt: 'Removeu',     cor: '#b91c1c', bg: '#fef2f2' },
}

const CAMPOS: { k: keyof Estado; nome: string; fmt: (v: unknown) => string }[] = [
  { k: 'armador',  nome: 'Armador',    fmt: v => ARMADOR_NOME[String(v)] ?? String(v) },
  { k: 'situacao', nome: 'Situação',   fmt: v => SITUACAO_NOME[String(v)] ?? String(v) },
  { k: 'pilha',    nome: 'Pilha',      fmt: v => PILHA_NOME[String(v)] ?? String(v) },
  { k: 'qtd',      nome: 'Quantidade', fmt: v => String(v) },
  { k: 'tamanho',  nome: 'Tamanho',    fmt: v => TAMANHO_NOME[String(v)] ?? String(v) },
  { k: 'obs',      nome: 'Nota',       fmt: v => `“${String(v)}”` },
]
const vazio = (v: unknown) => v == null || v === ''
const mostra = (c: typeof CAMPOS[number], v: unknown) => (vazio(v) ? '—' : c.fmt(v))

function mudancas(r: Registro): { nome: string; de: string | null; para: string }[] {
  // registros antigos (antes da auditoria) só têm o estado final nas colunas
  const depois: Estado = r.depois ?? (r.acao === 'removeu' ? {} : r)
  const antes = r.antes
  if (r.acao === 'removeu') return [{ nome: 'Pilha', de: antes ? `${ARMADOR_NOME[String(antes.armador)] ?? '—'}${antes.qtd != null ? ` · ${antes.qtd}` : ''}` : null, para: 'removida' }]
  const lista = CAMPOS
    .filter(c => !antes ? !vazio(depois[c.k]) : (antes[c.k] ?? null) !== (depois[c.k] ?? null))
    .map(c => ({ nome: c.nome, de: antes ? mostra(c, antes[c.k]) : null, para: mostra(c, depois[c.k]) }))
  if (antes && depois.x != null && (antes.x !== depois.x || antes.y !== depois.y || antes.ang !== depois.ang)) {
    lista.push({ nome: 'Lugar no mapa', de: null, para: antes.ang !== depois.ang && antes.x === depois.x && antes.y === depois.y ? `girou para ${depois.ang}°` : 'mudou de lugar' })
  }
  return lista
}

function dataHora(iso: string) {
  const d = new Date(iso)
  return {
    dia: d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora: d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

// 'R1 D4' / 'r1 d4.a' / 'R1' → padrão ilike da chave ('R1 D%|D4%')
function padraoPosicao(txt: string) {
  const m = txt.trim().toUpperCase().match(/^(R\d+)\s*([DE])?\s*(\d+[A-Z]?(?:\.[AB])?)?$/)
  if (!m) return null
  const [, rua, lado, num] = m
  return `${rua} ${lado ?? ''}%|${lado ?? ''}${num ?? ''}%`
}

export default async function HistoricoPatioPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string; posicao?: string; de?: string; ate?: string; pagina?: string }>
}) {
  const profile = await getMyProfile()
  if (!profile || profile.role !== 'admin') redirect('/patio')

  const sp = await searchParams
  const pagina = Math.max(1, Number(sp.pagina) || 1)
  const supabase = await createClient()

  let q = supabase
    .from('patio_historico')
    .select('id, chave, acao, criado_em, usuario_email, armador, situacao, pilha, qtd, obs, tamanho, antes, depois', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
  if (sp.usuario) q = q.eq('usuario_email', sp.usuario)
  const padrao = sp.posicao ? padraoPosicao(sp.posicao) : null
  if (padrao) q = q.ilike('chave', padrao)
  if (sp.de) q = q.gte('criado_em', new Date(`${sp.de}T00:00:00-03:00`).toISOString())
  if (sp.ate) q = q.lte('criado_em', new Date(`${sp.ate}T23:59:59-03:00`).toISOString())

  const [{ data, count, error }, { data: usuarios }] = await Promise.all([
    q,
    supabase.from('patio_historico').select('usuario_email').not('usuario_email', 'is', null).limit(2000),
  ])
  const registros = (data ?? []) as Registro[]
  const emails = [...new Set((usuarios ?? []).map(u => u.usuario_email as string))].sort()
  const total = count ?? 0
  const temMais = pagina * POR_PAGINA < total
  const qs = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) p.set(k, String(v))
    return `?${p.toString()}`
  }

  const campo = { fontSize: 13, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#1a2a3a' }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1a2a3a' }}>Histórico do Pátio</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Toda alteração feita no Mapa do Pátio: quem fez, quando e o que mudou</p>
        </div>
        <Link href="/patio" style={{ fontSize: 13, color: '#1B4F8A', textDecoration: 'none', whiteSpace: 'nowrap' }}>← Voltar ao mapa</Link>
      </div>

      <form className="bg-white rounded-xl p-3 mb-4 flex gap-2 flex-wrap items-end" style={{ border: '1px solid #e5e7eb' }}>
        <label className="flex flex-col gap-1 text-xs" style={{ color: '#6b7280' }}>Usuário
          <select name="usuario" defaultValue={sp.usuario ?? ''} style={campo}>
            <option value="">Todos</option>
            {emails.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: '#6b7280' }}>Posição
          <input name="posicao" defaultValue={sp.posicao ?? ''} placeholder="ex.: R1 D4" style={{ ...campo, width: 120 }} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: '#6b7280' }}>De
          <input type="date" name="de" defaultValue={sp.de ?? ''} style={campo} />
        </label>
        <label className="flex flex-col gap-1 text-xs" style={{ color: '#6b7280' }}>Até
          <input type="date" name="ate" defaultValue={sp.ate ?? ''} style={campo} />
        </label>
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#1B4F8A' }}>Filtrar</button>
        {(sp.usuario || sp.posicao || sp.de || sp.ate) && <Link href="/patio/historico" className="text-sm px-2 py-2" style={{ color: '#6b7280' }}>Limpar</Link>}
        <span className="text-xs ml-auto" style={{ color: '#6b7280' }}>{total.toLocaleString('pt-BR')} alteraç{total === 1 ? 'ão' : 'ões'}</span>
      </form>

      {sp.posicao && !padrao && <p className="text-sm mb-3" style={{ color: '#b91c1c' }}>Posição “{sp.posicao}” não reconhecida — use o formato R1 D4.</p>}
      {error && <p className="text-sm mb-3" style={{ color: '#b91c1c' }}>Erro ao carregar: {error.message}</p>}

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
        {registros.length === 0 ? (
          <p className="text-sm text-center p-10" style={{ color: '#9ca3af' }}>Nenhuma alteração encontrada.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse', color: '#374151' }}>
              <thead>
                <tr style={{ background: '#f9fafb', color: '#6b7280' }}>
                  {['Data e hora', 'Usuário', 'Posição', 'Ação', 'O que mudou'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-2.5" style={{ whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map(r => {
                  const { dia, hora } = dataHora(r.criado_em)
                  const a = ACAO[r.acao ?? 'alterou'] ?? ACAO.alterou
                  const lista = mudancas(r)
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6', verticalAlign: 'top' }}>
                      <td className="px-4 py-3" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        <div className="font-medium" style={{ color: '#1a2a3a' }}>{dia}</div>
                        <div className="text-xs" style={{ color: '#6b7280' }}>{hora}</div>
                      </td>
                      <td className="px-4 py-3" style={{ whiteSpace: 'nowrap' }}>
                        <Link href={`/patio/historico${qs({ usuario: r.usuario_email ?? '', pagina: '' })}`} style={{ color: '#1a2a3a', textDecoration: 'none' }}>{r.usuario_email ?? '—'}</Link>
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ whiteSpace: 'nowrap', color: '#1a2a3a' }}>
                        <Link href={`/patio/historico${qs({ posicao: nomePosicao(r.chave), pagina: '' })}`} style={{ color: 'inherit', textDecoration: 'none' }}>{nomePosicao(r.chave)}</Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: a.cor, background: a.bg, whiteSpace: 'nowrap' }}>{a.txt}</span>
                      </td>
                      <td className="px-4 py-3">
                        {lista.length === 0 ? <span style={{ color: '#9ca3af' }}>Salvou sem mudanças</span> : (
                          <ul className="space-y-0.5">
                            {lista.map(m => (
                              <li key={m.nome}>
                                <span style={{ color: '#6b7280' }}>{m.nome}:</span>{' '}
                                {m.de != null && <><span style={{ color: '#9ca3af', textDecoration: 'line-through' }}>{m.de}</span>{' → '}</>}
                                <strong style={{ color: '#1a2a3a' }}>{m.para}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                        {!r.antes && r.depois && r.acao === 'alterou' && (
                          <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>1ª alteração desta posição (antes: levantamento 24/09)</div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(pagina > 1 || temMais) && (
        <div className="flex justify-between mt-3 text-sm">
          {pagina > 1 ? <Link href={`/patio/historico${qs({ pagina: pagina - 1 })}`} style={{ color: '#1B4F8A' }}>← Mais recentes</Link> : <span />}
          {temMais && <Link href={`/patio/historico${qs({ pagina: pagina + 1 })}`} style={{ color: '#1B4F8A' }}>Mais antigas →</Link>}
        </div>
      )}
    </div>
  )
}
