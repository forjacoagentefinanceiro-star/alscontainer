import { createClient } from '@/lib/supabase/server'
import { BiDashboard, type Categoria, type Grupo, type KpiT } from '@/components/bi/BiDashboard'
import type { Ponto } from '@/components/bi/BiCharts'

export const dynamic = 'force-dynamic'

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
    grupos.push({ code, titulo: rows[0].titulo || code, data, series })
  }
  return grupos
}

function somaPorMes(g?: Grupo): Map<string, number> {
  const m = new Map<string, number>()
  if (!g) return m
  for (const p of g.data) m.set(p.eixo, g.series.reduce((acc, s) => acc + (Number(p[s]) || 0), 0))
  return m
}

export default async function BiPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('bi_indicadores')
    .select('code,titulo,serie,eixo,ano,valor,captured_at')

  const linhas = (rows ?? []) as Linha[]

  if (!linhas.length) {
    return (
      <div style={{ background: '#0d1b2e', borderRadius: 18, padding: 24, minHeight: '100%' }}>
        <h1 style={{ color: '#e6eef7', fontSize: 22, fontWeight: 700 }}>BI Depot</h1>
        <p style={{ color: '#8ca5c8', marginTop: 8 }}>
          Ainda não há indicadores. O robô roda diariamente; rode o workflow no GitHub Actions para popular agora.
        </p>
      </div>
    )
  }

  const ano = Math.max(...linhas.map(l => l.ano))
  // estimativas (Pendentes/Finalizadas da Televisão) são escalares — separadas dos gráficos mensais
  const estimativas = linhas.filter(l => /^ESTIMATIVA/.test(l.code) && l.ano === ano)
  const grupos = agrupar(linhas.filter(l => l.ano === ano && !/^ESTIMATIVA/.test(l.code)))

  // categorias (ordenadas), cada uma com seus grupos ordenados por código
  const catMap = new Map<string, Categoria & { ord: number }>()
  for (const g of grupos) {
    const c = categoria(g.code)
    if (!catMap.has(c.key)) catMap.set(c.key, { key: c.key, label: c.label, ord: c.ord, grupos: [] })
    catMap.get(c.key)!.grupos.push(g)
  }
  const categorias: Categoria[] = [...catMap.values()]
    .sort((a, b) => a.ord - b.ord)
    .map(c => ({ key: c.key, label: c.label, grupos: c.grupos.sort((a, b) => a.code.localeCompare(b.code)) }))

  // KPIs — foco no mês corrente (último mês com dados), com total do ano no subtítulo
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

  // mês corrente = último mês que tem dados
  const mes = [...new Set([...entradasMes.keys(), ...saidasMes.keys()])].sort((a, b) => mesIdx(b) - mesIdx(a))[0] ?? ''
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—')
  const entMes = entradasMes.get(mes) ?? 0
  const saiMes = saidasMes.get(mes) ?? 0
  const teusMes = (teusEntMes.get(mes) ?? 0) + (teusSaiMes.get(mes) ?? 0)

  // aguardando vistoria (estimativa ao vivo da Televisão)
  const ev = estimativas.find(e => /PENDENTE_VISTORIA/.test(e.code)) ?? estimativas.find(e => e.code === 'ESTIMATIVA_PENDENTE')

  const kpis: KpiT[] = [
    { label: `Entradas · ${cap(mes)}`, value: nf.format(entMes), sub: `ano: ${nf.format(entradasAno)}`, accent: true },
    { label: `Saídas · ${cap(mes)}`, value: nf.format(saiMes), sub: `ano: ${nf.format(saidasAno)}`, accent: true },
    { label: 'Aguardando vistoria', value: ev ? nf.format(Number(ev.valor) || 0) : '—', sub: 'estimativa (Televisão)' },
    { label: `TEUs · ${cap(mes)}`, value: nf.format(teusMes), sub: 'movimentados (ent + saí)' },
  ]

  const eixosTrend = [...new Set([...entradasMes.keys(), ...saidasMes.keys()])].sort((a, b) => mesIdx(a) - mesIdx(b))
  const trend: Ponto[] = eixosTrend.map(eixo => ({ eixo, Entradas: entradasMes.get(eixo) ?? 0, 'Saídas': saidasMes.get(eixo) ?? 0 }))

  const atualizadoRaw = linhas.reduce((max, l) => (l.captured_at > max ? l.captured_at : max), '')
  const atualizado = atualizadoRaw ? new Date(atualizadoRaw).toLocaleString('pt-BR') : '—'

  return <BiDashboard ano={ano} atualizado={atualizado} kpis={kpis} trend={trend} categorias={categorias} />
}
