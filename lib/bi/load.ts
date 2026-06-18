import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ponto } from '@/components/bi/BiCharts'

export type Grupo = { code: string; titulo: string; data: Ponto[]; series: string[]; medida: string }
export type Categoria = { key: string; label: string; grupos: Grupo[] }
export type KpiT = { label: string; value: string; sub?: string; accent?: boolean }
export type ConfItem = { eixo: string; total: number; soma: number; dif: number }
export type Conferencia = { metrica: string; itens: ConfItem[]; ok: boolean }
export type BiData = {
  empty: boolean
  ano: number
  atualizado: string
  kpis: KpiT[]
  trend: Ponto[]
  categorias: Categoria[]
  conferencia: Conferencia[]
}

const nf = new Intl.NumberFormat('pt-BR')
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const mesIdx = (s: string) => { const i = MESES.indexOf(norm(s)); return i < 0 ? 99 : i }

type Linha = { code: string; titulo: string | null; serie: string; eixo: string; ano: number; valor: number | null; captured_at: string }

function categoria(code: string): { key: string; label: string; ord: number } {
  if (/MOVIMENTACAO/.test(code)) return { key: 'movimentacao', label: 'Movimentação', ord: 1 }
  if (/OCUPACAO/.test(code)) return { key: 'patio', label: 'Pátio', ord: 2 }
  if (/VISTORIA/.test(code)) return { key: 'vistorias', label: 'Vistorias', ord: 3 }
  if (/REPARO/.test(code)) return { key: 'reparos', label: 'Reparos', ord: 4 }
  if (/PERMANENCIA/.test(code)) return { key: 'permanencia', label: 'Permanência', ord: 5 }
  return { key: 'outros', label: 'Outros', ord: 9 }
}

function agrupar(linhas: Linha[]): Grupo[] {
  const map = new Map<string, Linha[]>()
  for (const l of linhas) {
    if (!map.has(l.code)) map.set(l.code, [])
    map.get(l.code)!.push(l)
  }
  const grupos: Grupo[] = []
  for (const [code, rows] of map) {
    const eixos = [...new Set(rows.map(r => r.eixo))].sort((a, b) => mesIdx(a) - mesIdx(b))
    const series = [...new Set(rows.map(r => r.serie))]
    const data: Ponto[] = eixos.map(eixo => {
      const ponto: Ponto = { eixo }
      for (const s of series) ponto[s] = rows.find(x => x.eixo === eixo && x.serie === s)?.valor ?? 0
      return ponto
    })
    const medida = `${/TEUS/.test(code) ? 'TEUs' : 'QTD containers'} · por mês`
    grupos.push({ code, titulo: rows[0].titulo || code, data, series, medida })
  }
  return grupos
}

function somaPorMes(g?: Grupo): Map<string, number> {
  const m = new Map<string, number>()
  if (!g) return m
  for (const p of g.data) m.set(p.eixo, g.series.reduce((acc, s) => acc + (Number(p[s]) || 0), 0))
  return m
}

export async function loadBiData(supabase: SupabaseClient): Promise<BiData> {
  const { data: rows } = await supabase
    .from('bi_indicadores')
    .select('code,titulo,serie,eixo,ano,valor,captured_at')
  const linhas = (rows ?? []) as Linha[]
  if (!linhas.length) {
    return { empty: true, ano: new Date().getFullYear(), atualizado: '—', kpis: [], trend: [], categorias: [], conferencia: [] }
  }

  const ano = Math.max(...linhas.map(l => l.ano))
  const estimativas = linhas.filter(l => /^ESTIMATIVA/.test(l.code) && l.ano === ano)
  const grupos = agrupar(linhas.filter(l => l.ano === ano && !/^ESTIMATIVA/.test(l.code)))

  const catMap = new Map<string, Categoria & { ord: number }>()
  for (const g of grupos) {
    const c = categoria(g.code)
    if (!catMap.has(c.key)) catMap.set(c.key, { key: c.key, label: c.label, ord: c.ord, grupos: [] })
    catMap.get(c.key)!.grupos.push(g)
  }
  const categorias: Categoria[] = [...catMap.values()]
    .sort((a, b) => a.ord - b.ord)
    .map(c => ({ key: c.key, label: c.label, grupos: c.grupos.sort((a, b) => a.code.localeCompare(b.code)) }))

  const gEntrada = grupos.find(g => /ENTRADA/.test(g.code) && /CNTR/.test(g.code)) ?? grupos.find(g => /ENTRADA/.test(g.code))
  const gSaida = grupos.find(g => /SAIDA/.test(g.code) && /CNTR/.test(g.code)) ?? grupos.find(g => /SAIDA/.test(g.code))
  const gEntradaTeus = grupos.find(g => /ENTRADA/.test(g.code) && /TEUS/.test(g.code) && !/ARMADOR/.test(g.code))
  const gSaidaTeus = grupos.find(g => /SAIDA/.test(g.code) && /TEUS/.test(g.code) && !/ARMADOR/.test(g.code))

  const entradasMes = somaPorMes(gEntrada)
  const saidasMes = somaPorMes(gSaida)
  const teusEntMes = somaPorMes(gEntradaTeus)
  const teusSaiMes = somaPorMes(gSaidaTeus)
  const entradasAno = [...entradasMes.values()].reduce((a, b) => a + b, 0)
  const saidasAno = [...saidasMes.values()].reduce((a, b) => a + b, 0)

  const mes = [...new Set([...entradasMes.keys(), ...saidasMes.keys()])].sort((a, b) => mesIdx(b) - mesIdx(a))[0] ?? ''
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—')
  const entMes = entradasMes.get(mes) ?? 0
  const saiMes = saidasMes.get(mes) ?? 0
  const teusMes = (teusEntMes.get(mes) ?? 0) + (teusSaiMes.get(mes) ?? 0)

  const ev = estimativas.find(e => /PENDENTE_VISTORIA/.test(e.code)) ?? estimativas.find(e => e.code === 'ESTIMATIVA_PENDENTE')

  const kpis: KpiT[] = [
    { label: `Entradas · ${cap(mes)}`, value: nf.format(entMes), sub: `ano: ${nf.format(entradasAno)}`, accent: true },
    { label: `Saídas · ${cap(mes)}`, value: nf.format(saiMes), sub: `ano: ${nf.format(saidasAno)}`, accent: true },
    { label: 'Aguardando vistoria', value: ev ? nf.format(Number(ev.valor) || 0) : '—' },
    { label: `Total mov. · ${cap(mes)}`, value: nf.format(entMes + saiMes), sub: `${nf.format(teusMes)} TEUs · entradas + saídas` },
  ]

  const eixosTrend = [...new Set([...entradasMes.keys(), ...saidasMes.keys()])].sort((a, b) => mesIdx(a) - mesIdx(b))
  const trend: Ponto[] = eixosTrend.map(eixo => ({ eixo, Entradas: entradasMes.get(eixo) ?? 0, 'Saídas': saidasMes.get(eixo) ?? 0 }))

  // Conferência: cruza o total de uma métrica com a soma das suas quebras.
  // Se a extração perdeu/duplicou algo, a diferença sai ≠ 0.
  const gEntradaArmadorTeus = grupos.find(g => /ENTRADA/.test(g.code) && /TEUS/.test(g.code) && /ARMADOR/.test(g.code))
  const gSaidaArmadorTeus = grupos.find(g => /SAIDA/.test(g.code) && /TEUS/.test(g.code) && /ARMADOR/.test(g.code))
  const gOcup = grupos.find(g => /OCUPACAO/.test(g.code) && !/ARMADOR/.test(g.code))
  const gOcupArm = grupos.find(g => /OCUPACAO/.test(g.code) && /ARMADOR/.test(g.code))

  const checa = (metrica: string, gT?: Grupo, gD?: Grupo): Conferencia | null => {
    if (!gT || !gD) return null
    const tot = somaPorMes(gT)
    const det = somaPorMes(gD)
    const eixos = [...new Set([...tot.keys(), ...det.keys()])].sort((a, b) => mesIdx(a) - mesIdx(b))
    const itens: ConfItem[] = eixos.map(eixo => {
      const t = Math.round(tot.get(eixo) ?? 0)
      const s = Math.round(det.get(eixo) ?? 0)
      return { eixo, total: t, soma: s, dif: t - s }
    })
    return { metrica, itens, ok: itens.every(i => i.dif === 0) }
  }

  const conferencia = [
    checa('TEUs entrada · total × soma por armador', gEntradaTeus, gEntradaArmadorTeus),
    checa('TEUs saída · total × soma por armador', gSaidaTeus, gSaidaArmadorTeus),
    checa('Ocupação de pátio · total × soma por armador', gOcup, gOcupArm),
  ].filter((c): c is Conferencia => c !== null)

  const atualizadoRaw = linhas.reduce((max, l) => (l.captured_at > max ? l.captured_at : max), '')
  const atualizado = atualizadoRaw ? new Date(atualizadoRaw).toLocaleString('pt-BR') : '—'

  return { empty: false, ano, atualizado, kpis, trend, categorias, conferencia }
}
