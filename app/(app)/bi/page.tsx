import { createClient } from '@/lib/supabase/server'
import { IndicadorBar, TendenciaLinha, type Ponto } from '@/components/bi/BiCharts'

export const dynamic = 'force-dynamic'

const nf = new Intl.NumberFormat('pt-BR')
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const mesIdx = (s: string) => { const i = MESES.indexOf(norm(s)); return i < 0 ? 99 : i }

type Linha = { code: string; titulo: string | null; serie: string; eixo: string; ano: number; valor: number | null; captured_at: string }
type Grupo = { code: string; titulo: string; eixos: string[]; series: string[]; data: Ponto[]; total: number }

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
      for (const s of series) {
        const r = rows.find(x => x.eixo === eixo && x.serie === s)
        ponto[s] = r?.valor ?? 0
      }
      return ponto
    })
    const total = rows.reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
    grupos.push({ code, titulo: rows[0].titulo || code, eixos, series, data, total })
  }
  return grupos
}

/** Soma por mês de um grupo (todas as séries). */
function somaPorMes(g?: Grupo): Map<string, number> {
  const m = new Map<string, number>()
  if (!g) return m
  for (const p of g.data) {
    const t = g.series.reduce((acc, s) => acc + (Number(p[s]) || 0), 0)
    m.set(p.eixo, t)
  }
  return m
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#5f7da0' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: accent ? '#7DC242' : '#e6eef7', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#5f7da0', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0f2138', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#cfe0f2', marginBottom: 10 }}>{titulo}</h3>
      {children}
    </div>
  )
}

export default async function BiPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('bi_indicadores')
    .select('code,titulo,serie,eixo,ano,valor,captured_at')

  const linhas = (rows ?? []) as Linha[]
  const panel: React.CSSProperties = { background: '#0d1b2e', borderRadius: 18, padding: 24, minHeight: '100%' }

  if (!linhas.length) {
    return (
      <div style={panel}>
        <h1 style={{ color: '#e6eef7', fontSize: 22, fontWeight: 700 }}>BI — Depot de Containers</h1>
        <p style={{ color: '#8ca5c8', marginTop: 8 }}>
          Ainda não há indicadores. O robô de extração roda diariamente; rode o workflow
          &quot;Extrair indicadores do websag&quot; no GitHub Actions para popular agora.
        </p>
      </div>
    )
  }

  const ano = Math.max(...linhas.map(l => l.ano))
  const grupos = agrupar(linhas.filter(l => l.ano === ano)).sort((a, b) => a.code.localeCompare(b.code))

  const gEntrada = grupos.find(g => /ENTRADA/.test(g.code) && /CNTR/.test(g.code)) ?? grupos.find(g => /ENTRADA/.test(g.code))
  const gSaida = grupos.find(g => /SAIDA/.test(g.code) && /CNTR/.test(g.code)) ?? grupos.find(g => /SAIDA/.test(g.code))

  const entradasMes = somaPorMes(gEntrada)
  const saidasMes = somaPorMes(gSaida)
  const entradasAno = [...entradasMes.values()].reduce((a, b) => a + b, 0)
  const saidasAno = [...saidasMes.values()].reduce((a, b) => a + b, 0)

  const eixosTrend = [...new Set([...entradasMes.keys(), ...saidasMes.keys()])].sort((a, b) => mesIdx(a) - mesIdx(b))
  const trend: Ponto[] = eixosTrend.map(eixo => ({ eixo, Entradas: entradasMes.get(eixo) ?? 0, 'Saídas': saidasMes.get(eixo) ?? 0 }))

  const atualizado = linhas.reduce((max, l) => (l.captured_at > max ? l.captured_at : max), '')
  const atualizadoFmt = atualizado ? new Date(atualizado).toLocaleString('pt-BR') : '—'

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ color: '#e6eef7', fontSize: 22, fontWeight: 700 }}>BI — Depot de Containers</h1>
          <p style={{ color: '#5f7da0', fontSize: 13 }}>Dados do e-Professional (websag) · ano {ano}</p>
        </div>
        <div style={{ color: '#5f7da0', fontSize: 12, textAlign: 'right' }}>
          atualizado em<br /><span style={{ color: '#8ca5c8' }}>{atualizadoFmt}</span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi label="Entradas (ano)" value={nf.format(entradasAno)} accent />
        <Kpi label="Saídas (ano)" value={nf.format(saidasAno)} accent />
        <Kpi label="Saldo" value={nf.format(entradasAno - saidasAno)} sub="entradas − saídas" />
        <Kpi label="Indicadores" value={nf.format(grupos.length)} sub="coletados do BI" />
      </div>

      {/* Tendência entradas × saídas */}
      {trend.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Card titulo="Entradas × Saídas por mês">
            <TendenciaLinha data={trend} series={['Entradas', 'Saídas']} />
          </Card>
        </div>
      )}

      {/* Grade de indicadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {grupos.map(g => (
          <Card key={g.code} titulo={g.titulo}>
            <IndicadorBar data={g.data} series={g.series} />
          </Card>
        ))}
      </div>
    </div>
  )
}
