import type { SupabaseClient } from '@supabase/supabase-js'
import type { Ponto } from '@/components/bi/BiCharts'

export type Grupo = { code: string; titulo: string; data: Ponto[]; series: string[]; medida: string }
export type Categoria = { key: string; label: string; grupos: Grupo[] }
export type KpiT = { label: string; value: string; sub?: string; accent?: boolean; cor?: string; destaque?: boolean; compact?: boolean; grupo?: string }
export type ConfItem = { eixo: string; total: number; soma: number; dif: number }
export type Conferencia = { metrica: string; itens: ConfItem[]; ok: boolean }
export type FaturamentoResumo = {
  mesLabel: string
  mesReal: number | null
  mesTerminal: number | null
  mesDepot: number | null
  terminalAFaturar: number | null
  projecao: number | null
  metaMes: number | null
  pctMeta: number | null
  faltaMeta: number | null
  metaAtingida: boolean
  anualTerminal: number | null
  anualDepot: number | null
  anualTotal: number | null
}

export type ComparacaoMetrica = {
  hoje: number | null
  mesPassado: number | null
  delta: number | null
  pct: number | null // % de variação
}
export type ComparacaoDia = {
  dataHoje: string        // "2026-07-09"
  dataMesPassado: string  // "2026-06-09"
  temDados: boolean       // false = ainda sem histórico do mês passado
  movEntrada: ComparacaoMetrica
  movSaida: ComparacaoMetrica
  faturamento: ComparacaoMetrica
}

export type BiData = {
  empty: boolean
  ano: number
  atualizado: string
  kpis: KpiT[]
  trend: Ponto[]
  categorias: Categoria[]
  conferencia: Conferencia[]
  faturamentoResumo: FaturamentoResumo | null
  faturamentoMensal: Grupo | null
  faturamentoAnual: Grupo | null
  metasPorMes: Record<string, number>
  comparacaoDia: ComparacaoDia | null
}

const nf = new Intl.NumberFormat('pt-BR')
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const mesIdx = (s: string) => { const i = MESES.indexOf(norm(s)); return i < 0 ? 99 : i }

type Linha = { code: string; titulo: string | null; serie: string; eixo: string; ano: number; valor: number | null; captured_at: string; data_ref: string | null }

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

// Retorna "2026-07-09" no fuso Brasília
function dataHojeBrasilia(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}
// Mesmo dia do mês passado: "2026-07-09" → "2026-06-09"
function mesmoDiaMesPassado(hoje: string): string {
  const [y, m, d] = hoje.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 2, d)) // m-2 porque meses em JS são 0-indexed e queremos o mês anterior
  return dt.toLocaleDateString('sv-SE', { timeZone: 'UTC' })
}
// Nome do mês em português (minúsculo, normalizado) a partir de uma data ISO "YYYY-MM-DD"
function nomeMesDaData(iso: string): string {
  return MESES[parseInt(iso.slice(5, 7), 10) - 1] ?? ''
}

function calcMetrica(hoje: number | null, passado: number | null): ComparacaoMetrica {
  const delta = hoje != null && passado != null ? hoje - passado : null
  const pct = delta != null && passado != null && passado !== 0 ? Math.round((delta / passado) * 1000) / 10 : null
  return { hoje, mesPassado: passado, delta, pct }
}

export async function loadBiData(supabase: SupabaseClient): Promise<BiData> {
  const { data: rows } = await supabase
    .from('bi_indicadores')
    .select('code,titulo,serie,eixo,ano,valor,captured_at,data_ref')
  const linhas = (rows ?? []) as Linha[]
  if (!linhas.length) {
    return { empty: true, ano: new Date().getFullYear(), atualizado: '—', kpis: [], trend: [], categorias: [], conferencia: [], faturamentoResumo: null, faturamentoMensal: null, faturamentoAnual: null, metasPorMes: {}, comparacaoDia: null }
  }

  // Para gráficos/KPIs: desduplicar mantendo o snapshot mais recente por (code,serie,eixo,ano)
  // (múltiplos data_ref = múltiplos dias acumulados; queremos o mais atual)
  const latestMap = new Map<string, Linha>()
  for (const l of linhas) {
    const key = `${l.code}|${l.serie}|${l.eixo}|${l.ano}`
    const ex = latestMap.get(key)
    if (!ex || (l.data_ref ?? '') > (ex.data_ref ?? '')) latestMap.set(key, l)
  }
  const linhasLatest = [...latestMap.values()]

  const ymdMeta = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date())
  const [anoMeta, mesMeta] = ymdMeta.split('-').map(Number)
  const { data: metaRow } = await supabase.from('bi_metas').select('valor').eq('ano', anoMeta).eq('mes', mesMeta).maybeSingle()
  const metaMes = metaRow?.valor != null ? Number(metaRow.valor) : null

  const ano = Math.max(...linhasLatest.map(l => l.ano))
  const faturamentoRows = linhasLatest.filter(l => /^FATURAMENTO/.test(l.code) && l.ano === ano)
  const terminalRows = linhasLatest.filter(l => /^TERMINAL_/.test(l.code) && l.ano === ano)
  const grupos = agrupar(linhasLatest.filter(l => l.ano === ano && !/^(ESTIMATIVA|FATURAMENTO|TERMINAL)/.test(l.code)))

  const catMap = new Map<string, Categoria & { ord: number }>()
  for (const g of grupos) {
    const c = categoria(g.code)
    if (!catMap.has(c.key)) catMap.set(c.key, { key: c.key, label: c.label, ord: c.ord, grupos: [] })
    catMap.get(c.key)!.grupos.push(g)
  }
  const categorias: Categoria[] = [...catMap.values()]
    .sort((a, b) => a.ord - b.ord)
    .map(c => ({ key: c.key, label: c.label, grupos: c.grupos.sort((a, b) => a.code.localeCompare(b.code)) }))

  // Prioridade: código exato do endpoint (containers, sem TEUs/Armador), depois qualquer ENTRADA sem essas flags
  const gEntrada = grupos.find(g => g.code === 'GetMovimentacoesEntrada')
    ?? grupos.find(g => /ENTRADA/.test(g.code) && !/TEUS|ARMADOR/.test(g.code))
    ?? grupos.find(g => /ENTRADA/.test(g.code))
  const gSaida = grupos.find(g => g.code === 'GetMovimentacoesSaida')
    ?? grupos.find(g => /SAIDA/.test(g.code) && !/TEUS|ARMADOR/.test(g.code))
    ?? grupos.find(g => /SAIDA/.test(g.code))
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

  const kpis: KpiT[] = [
    { label: `Depot · Entradas · ${cap(mes)}`, value: nf.format(entMes), sub: `ano: ${nf.format(entradasAno)} · fonte: ${gEntrada?.code ?? '—'}`, accent: true },
    { label: `Depot · Saídas · ${cap(mes)}`, value: nf.format(saiMes), sub: `ano: ${nf.format(saidasAno)} · fonte: ${gSaida?.code ?? '—'}`, accent: true },
    { label: `Depot · Total mov. · ${cap(mes)}`, value: nf.format(entMes + saiMes), sub: `${nf.format(teusMes)} TEUs · entradas + saídas` },
  ]

  // Movimentação do terminal (mês corrente até agora) — vinda do escala
  const tv = (code: string): number | null => {
    const r = terminalRows.find(x => x.code === code)
    return r && r.valor != null ? Number(r.valor) : null
  }
  const termEnt = tv('TERMINAL_ENTRADA')
  const termSai = tv('TERMINAL_SAIDA')
  if (termEnt != null || termSai != null) {
    kpis.push({ label: `Terminal · Entradas · ${cap(mes)}`, value: nf.format(termEnt ?? 0), cor: '#4FA3D1' })
    kpis.push({ label: `Terminal · Saídas · ${cap(mes)}`, value: nf.format(termSai ?? 0), cor: '#4FA3D1' })
    kpis.push({ label: `Terminal · Total mov. · ${cap(mes)}`, value: nf.format((termEnt ?? 0) + (termSai ?? 0)), sub: 'entradas + saídas', cor: '#4FA3D1' })
  }

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

  // Faturamento (escala / painel 236) — valores escalares
  const fv = (code: string): number | null => {
    const r = faturamentoRows.find(x => x.code === code)
    return r && r.valor != null ? Number(r.valor) : null
  }
  const somaBrl = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0))
  const fatAnualTerminal = fv('FATURAMENTO_ANUAL_TERMINAL')
  const fatAnualDepot = fv('FATURAMENTO_ANUAL_DEPOT')
  const fatMesTerminal = fv('FATURAMENTO_MES_TERMINAL')
  const fatMesDepot = fv('FATURAMENTO_MES_DEPOT')
  const fatAFaturar = fv('FATURAMENTO_TERMINAL_AFATURAR')
  const fatMesTotal = somaBrl(fatMesTerminal, fatMesDepot)
  const projecao = somaBrl(fatMesTotal, fatAFaturar)
  // "falta para a meta" e "% atingido" usam o faturamento REAL do mês (fatMesTotal), não a projeção
  const faltaMeta = metaMes != null ? Math.max(0, metaMes - (fatMesTotal ?? 0)) : null
  const metaAtingida = metaMes != null && (fatMesTotal ?? 0) >= metaMes
  const pctMeta = metaMes != null && metaMes > 0 ? Math.round(((fatMesTotal ?? 0) / metaMes) * 1000) / 10 : null

  // "mês atual" do faturamento é sempre o mês do calendário real (Brasília), não uma heurística sobre os dados de movimentação
  const mesLabelAtual = cap(MESES[mesMeta - 1] ?? mes)

  const faturamentoResumo: FaturamentoResumo | null = faturamentoRows.length
    ? {
        mesLabel: mesLabelAtual,
        mesReal: fatMesTotal,
        mesTerminal: fatMesTerminal,
        mesDepot: fatMesDepot,
        terminalAFaturar: fatAFaturar,
        projecao,
        metaMes,
        pctMeta,
        faltaMeta,
        metaAtingida,
        anualTerminal: fatAnualTerminal,
        anualDepot: fatAnualDepot,
        anualTotal: somaBrl(fatAnualTerminal, fatAnualDepot),
      }
    : null

  // Faturamento mês a mês (Terminal + Depot) — vira um gráfico empilhado
  const fatMensalRows = faturamentoRows.filter(l => l.code === 'FATURAMENTO_MENSAL')
  let faturamentoMensal: Grupo | null = null
  if (fatMensalRows.length) {
    const eixos = [...new Set(fatMensalRows.map(r => r.eixo))].sort((a, b) => mesIdx(a) - mesIdx(b))
    const series = [...new Set(fatMensalRows.map(r => r.serie))]
    const data: Ponto[] = eixos.map(eixo => {
      const p: Ponto = { eixo }
      for (const s of series) p[s] = fatMensalRows.find(x => x.eixo === eixo && x.serie === s)?.valor ?? 0
      return p
    })
    faturamentoMensal = { code: 'FATURAMENTO_MENSAL', titulo: 'Faturamento por mês (Terminal + Depot)', data, series, medida: 'R$ · por mês' }
  }

  // metas de cada mês do ano (para navegar entre meses na aba Faturamento) — chave = mesmo eixo usado no gráfico mensal
  const metasPorMes: Record<string, number> = {}
  if (faturamentoMensal) {
    const { data: metasRows } = await supabase.from('bi_metas').select('mes, valor').eq('ano', ano)
    const porMesNum = new Map((metasRows ?? []).map(r => [r.mes as number, Number(r.valor)]))
    for (const eixo of faturamentoMensal.data.map(p => p.eixo)) {
      const idx = mesIdx(eixo)
      if (idx < 12) {
        const v = porMesNum.get(idx + 1)
        if (v != null) metasPorMes[eixo] = v
      }
    }
  }

  // Faturamento por ano (evolução 2023 → ano corrente)
  const fatAnoRows = faturamentoRows.filter(l => l.code === 'FATURAMENTO_ANO')
  let faturamentoAnual: Grupo | null = null
  if (fatAnoRows.length) {
    const eixos = [...new Set(fatAnoRows.map(r => r.eixo))].sort()
    const series = [...new Set(fatAnoRows.map(r => r.serie))]
    const data: Ponto[] = eixos.map(eixo => {
      const p: Ponto = { eixo }
      for (const s of series) p[s] = fatAnoRows.find(x => x.eixo === eixo && x.serie === s)?.valor ?? 0
      return p
    })
    faturamentoAnual = { code: 'FATURAMENTO_ANO', titulo: 'Faturamento por ano (Terminal + Depot)', data, series, medida: 'R$ · por ano' }
  }

  const atualizadoRaw = linhasLatest.reduce((max, l) => (l.captured_at > max ? l.captured_at : max), '')
  const atualizado = atualizadoRaw ? new Date(atualizadoRaw).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'

  // Comparação "hoje vs mesmo dia do mês passado"
  const dataHoje = dataHojeBrasilia()
  const dataMesPassado = mesmoDiaMesPassado(dataHoje)
  const mesHoje = nomeMesDaData(dataHoje)
  const mesPassadoNome = nomeMesDaData(dataMesPassado)

  // Helper: busca o valor somado de todas as séries de um code numa data_ref específica
  const somaCode = (code: RegExp, dataRef: string, eixo?: string): number | null => {
    const subset = linhas.filter(l =>
      code.test(l.code) &&
      l.data_ref === dataRef &&
      (eixo == null || norm(l.eixo) === norm(eixo))
    )
    if (!subset.length) return null
    return subset.reduce((acc, l) => acc + (l.valor ?? 0), 0)
  }

  const entHoje = somaCode(/^GetMovimentacoesEntrada$/, dataHoje, mesHoje)
  const entPassado = somaCode(/^GetMovimentacoesEntrada$/, dataMesPassado, mesPassadoNome)
  const saiHoje = somaCode(/^GetMovimentacoesSaida$/, dataHoje, mesHoje)
  const saiPassado = somaCode(/^GetMovimentacoesSaida$/, dataMesPassado, mesPassadoNome)

  // Faturamento: usa os dois codes de escala com eixo "Atual"
  const fatHoje = (() => {
    const t = linhas.find(l => l.code === 'FATURAMENTO_MES_TERMINAL' && l.data_ref === dataHoje)?.valor ?? null
    const d = linhas.find(l => l.code === 'FATURAMENTO_MES_DEPOT' && l.data_ref === dataHoje)?.valor ?? null
    return t != null || d != null ? (t ?? 0) + (d ?? 0) : null
  })()
  const fatPassado = (() => {
    const t = linhas.find(l => l.code === 'FATURAMENTO_MES_TERMINAL' && l.data_ref === dataMesPassado)?.valor ?? null
    const d = linhas.find(l => l.code === 'FATURAMENTO_MES_DEPOT' && l.data_ref === dataMesPassado)?.valor ?? null
    return t != null || d != null ? (t ?? 0) + (d ?? 0) : null
  })()

  const temDados = entPassado != null || saiPassado != null || fatPassado != null
  const comparacaoDia: ComparacaoDia = {
    dataHoje,
    dataMesPassado,
    temDados,
    movEntrada: calcMetrica(entHoje, entPassado),
    movSaida: calcMetrica(saiHoje, saiPassado),
    faturamento: calcMetrica(fatHoje, fatPassado),
  }

  return { empty: false, ano, atualizado, kpis, trend, categorias, conferencia, faturamentoResumo, faturamentoMensal, faturamentoAnual, metasPorMes, comparacaoDia }
}
