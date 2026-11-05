'use client'

import { useMemo, useState } from 'react'
import { brl } from '@/lib/vendas/config'
import { calcLocacao, mesesCobrados, type Modo, type ExtrasLoc } from '@/lib/vendas/locacao'
import { gerarPropostaPdf, baixarBlob } from '@/lib/vendas/propostaPdf'
import { salvarProposta, atualizarProposta } from '@/app/(app)/vendas/propostas-actions'
import { card, input, btn, btnAzul, btnLeve } from './ui'

export type ItemProprio = { id: string; numero: string; tamanho: string; ano: number | null; aquisicao: number | null }
type Cliente = { nome: string; telefone: string; email: string; documento: string; cidade: string }

export type LinhaLoc = {
  uid: string; estoqueId: string | null; origem: 'proprio' | 'terceiro'; fornecedor: string
  descricao: string; detalhe: string; numero: string | null; ano: number | null
  qtd: number; unit: number                 // unit = diária cobrada do cliente
  custoMensal: number | null; modo: Modo    // só admin
}
export type InicialLoc = {
  id: string; codigo: string; status: string; validade: string; dias: number; extras: ExtrasLoc
  pagamento: string; frete: string; obs: string; leadId: string | null; linhas: LinhaLoc[]
}

const MODELOS = [
  { key: '20', nome: "Container 20' (terceiro)" }, { key: '40dry', nome: "Container 40' Dry (terceiro)" }, { key: '40hc', nome: "Container 40' High Cube (terceiro)" },
]
const num = (v: string) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const dataBr = (d: Date) => d.toLocaleDateString('pt-BR')
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const hojeIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const cor = (n: number) => (n < 0 ? '#dc2626' : '#16a34a')

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600">{t}<div className="mt-1 font-normal">{children}</div></label>
}
const Money = ({ v, on, cls = 'w-28' }: { v: number | null | undefined; on: (n: number) => void; cls?: string }) => (
  <input className={`${cls} rounded-lg border border-slate-300 px-2 py-1 text-sm`} inputMode="decimal" defaultValue={v ? String(v).replace('.', ',') : ''} placeholder="0,00" onChange={e => on(num(e.target.value))} />
)

export default function LocacaoForm({ proprios, cliente: c0, verMargem, leadId = null, inicial }: {
  proprios: ItemProprio[]; cliente: Cliente; verMargem: boolean; leadId?: string | null; inicial?: InicialLoc
}) {
  const [cli, setCli] = useState<Cliente>(c0)
  const [linhas, setLinhas] = useState<LinhaLoc[]>(inicial?.linhas ?? [])
  const [dias, setDias] = useState(inicial?.dias ?? 10)
  const [ex, setEx] = useState<ExtrasLoc>({ inicio: hojeIso(), ...(inicial?.extras ?? {}) })
  const [validade, setValidade] = useState(inicial?.validade ?? (() => { const d = new Date(Date.now() + 7 * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) })())
  const [pagamento, setPagamento] = useState(inicial?.pagamento ?? 'Pagamento antecipado (Pix ou transferência) antes da entrega do container.')
  const [frete, setFrete] = useState(inicial?.frete ?? 'Entrega e retirada do container por conta do locatário, conforme valor informado nesta proposta.')
  const [obs, setObs] = useState(inicial?.obs ?? 'Prazo de locação contado a partir da entrega. Danos ao container durante a locação são de responsabilidade do locatário. Prorrogação mediante nova diária.')
  const bloqueada = inicial?.status === 'vendida'
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salva, setSalva] = useState<string | null>(null)

  const sel = useMemo(() => new Set(linhas.map(l => l.estoqueId).filter(Boolean)), [linhas])
  const mud = (uid: string, p: Partial<LinhaLoc>) => setLinhas(ls => ls.map(l => l.uid === uid ? { ...l, ...p } : l))
  const setE = (p: Partial<ExtrasLoc>) => setEx(e => ({ ...e, ...p }))

  function alternar(i: ItemProprio) {
    setLinhas(ls => sel.has(i.id) ? ls.filter(l => l.estoqueId !== i.id) : [...ls, {
      uid: i.id, estoqueId: i.id, origem: 'proprio', fornecedor: '', descricao: `Container ${i.tamanho} · nº ${i.numero}`,
      detalhe: 'Locação com entrega e retirada conforme combinado', numero: i.numero, ano: i.ano, qtd: 1, unit: 0, custoMensal: verMargem ? 0 : null, modo: 'proporcional',
    }])
  }
  function terceiro(m: (typeof MODELOS)[number]) {
    setLinhas(ls => [...ls, {
      uid: `tc-${Date.now()}-${ls.length}`, estoqueId: null, origem: 'terceiro', fornecedor: '', descricao: m.nome.replace(' (terceiro)', ''),
      detalhe: 'Locação com entrega e retirada conforme combinado', numero: null, ano: null, qtd: 1, unit: 0, custoMensal: verMargem ? 0 : null, modo: 'cheio',
    }])
  }

  const itensCalc = linhas.map(l => ({ qtd: l.qtd, unit: l.unit, origem: l.origem, custo_mensal: l.custoMensal, modo: l.modo }))
  const r = calcLocacao(itensCalc, dias, ex)
  const unidades = linhas.reduce((s, l) => s + l.qtd, 0)

  async function gerar(comPdf = true) {
    setErro(null); setSalva(null)
    if (!cli.nome.trim()) return setErro('Informe o nome do cliente.')
    if (!linhas.length) return setErro('Selecione ao menos um container.')
    if (dias < 1) return setErro('Informe o prazo da locação em dias.')
    if (linhas.some(l => l.qtd < 1 || l.unit <= 0)) return setErro('Confira quantidade e diária de todos os itens.')
    setGerando(true)
    try {
      const itens = linhas.map(l => ({
        container_id: l.estoqueId, numero: l.numero, ano: l.ano, descricao: l.descricao, detalhe: l.detalhe, qtd: l.qtd, unit: l.unit,
        origem: l.origem, fornecedor: l.fornecedor, custo_mensal: verMargem ? l.custoMensal : null, modo: l.modo,
      }))
      const extras: ExtrasLoc = verMargem ? ex : { inicio: ex.inicio, frete_cobrado: ex.frete_cobrado, taxa_cobrada: ex.taxa_cobrada }
      const dados = {
        tipo: 'locacao' as const, dias, extras, cliente_nome: cli.nome, telefone: cli.telefone, email: cli.email, documento: cli.documento, cidade: cli.cidade,
        lead_id: inicial?.leadId ?? leadId, itens, validade, pagamento, frete, observacoes: obs, ilustrativas: false,
      }
      const res = inicial ? await atualizarProposta(inicial.id, dados) : await salvarProposta(dados)
      if ('erro' in res) { setErro(res.erro); setGerando(false); return }
      if (comPdf) {
        const { blob, nome } = await gerarPropostaPdf({
          numero: res.codigo, emissao: dataBr(new Date(res.criado_em)), validade: dataBr(new Date(validade + 'T12:00:00')), cliente: cli,
          itens: itens.map(i => ({ descricao: i.descricao, detalhe: i.detalhe, qtd: i.qtd, unit: i.unit, numero: i.numero, ano: i.ano })),
          pagamento, frete, observacoes: obs, ilustrativas: false,
          locacao: { dias, inicio: ex.inicio ? dataBr(new Date(ex.inicio + 'T12:00:00')) : '', extras: [
            ...(ex.frete_cobrado ? [{ rotulo: 'Frete (entrega e retirada)', valor: ex.frete_cobrado }] : []),
            ...(ex.taxa_cobrada ? [{ rotulo: 'Taxas adicionais', valor: ex.taxa_cobrada }] : []),
          ] },
        })
        baixarBlob(blob, nome)
      }
      setSalva(res.codigo)
    } catch (e) { setErro(`Não foi possível gerar o PDF: ${(e as Error).message}`) }
    setGerando(false)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
      <div className="space-y-4">
        <section className={`${card} p-4`}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0d1b2e' }}>1. Dados do cliente</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Nome / razão social *"><input className={input} value={cli.nome} onChange={e => setCli({ ...cli, nome: e.target.value })} /></L>
            <L t="CPF / CNPJ"><input className={input} value={cli.documento} onChange={e => setCli({ ...cli, documento: e.target.value })} /></L>
            <L t="WhatsApp / telefone"><input className={input} inputMode="tel" value={cli.telefone} onChange={e => setCli({ ...cli, telefone: e.target.value })} /></L>
            <L t="E-mail"><input className={input} type="email" value={cli.email} onChange={e => setCli({ ...cli, email: e.target.value })} /></L>
            <L t="Cidade"><input className={input} value={cli.cidade} onChange={e => setCli({ ...cli, cidade: e.target.value })} /></L>
          </div>
        </section>

        <section className={`${card} p-4`}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0d1b2e' }}>2. Prazo</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <L t="Prazo (dias) *"><input className={input} type="number" min={1} value={dias} onChange={e => setDias(Math.max(1, Number(e.target.value) || 1))} /></L>
            <L t="Início previsto"><input className={input} type="date" value={ex.inicio ?? ''} onChange={e => setE({ inicio: e.target.value })} /></L>
            <L t="Proposta válida até"><input className={input} type="date" value={validade} onChange={e => setValidade(e.target.value)} /></L>
          </div>
        </section>

        <section className={`${card} p-4`}>
          <h2 className="font-bold text-sm mb-1" style={{ color: '#0d1b2e' }}>3. Containers</h2>
          <p className="text-xs text-slate-500 mb-2">Próprios (livres no estoque) ou de terceiros (que você aluga do fornecedor).</p>
          <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {proprios.map(i => (
              <label key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={sel.has(i.id)} onChange={() => alternar(i)} />
                <span className="font-mono font-semibold">{i.numero}</span>
                <span className="text-slate-600">{i.tamanho}{i.ano ? ` · ${i.ano}` : ''}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-slate-100">próprio</span>
              </label>
            ))}
            {proprios.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhum container próprio livre para locação.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-slate-500">Container de terceiro:</span>
            {MODELOS.map(m => <button key={m.key} type="button" className={btnLeve} onClick={() => terceiro(m)}>+ {m.nome.replace('Container ', '').replace(' (terceiro)', '')}</button>)}
          </div>
        </section>

        {linhas.length > 0 && (
          <section className={`${card} p-4`}>
            <h2 className="font-bold text-sm mb-3" style={{ color: '#0d1b2e' }}>4. Itens e custos</h2>
            <div className="space-y-3">
              {linhas.map(l => {
                const meses = mesesCobrados(dias, l.modo)
                const custoItem = l.qtd * (l.custoMensal ?? 0) * meses
                const recItem = l.qtd * l.unit * dias
                const lu = recItem - custoItem
                return (
                  <div key={l.uid} className="border border-slate-200 rounded-xl p-3 grid gap-2 sm:grid-cols-[1fr_80px_70px_130px_auto] items-end">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full text-white" style={{ background: l.origem === 'proprio' ? '#1B4F8A' : '#d97706' }}>{l.origem === 'proprio' ? 'Próprio' : 'Terceiro'}</span>
                        <input className={input} value={l.descricao} onChange={e => mud(l.uid, { descricao: e.target.value })} />
                      </div>
                      <input className={`${input} text-xs`} value={l.detalhe} onChange={e => mud(l.uid, { detalhe: e.target.value })} placeholder="Detalhe (condição, entrega…)" />
                    </div>
                    <L t="Ano"><input className={input} inputMode="numeric" placeholder="aaaa" value={l.ano ?? ''} disabled={!!l.estoqueId} onChange={e => mud(l.uid, { ano: Number(e.target.value.replace(/\D/g, '').slice(0, 4)) || null })} /></L>
                    <L t="Qtd"><input className={input} type="number" min={1} value={l.qtd} onChange={e => mud(l.uid, { qtd: Math.max(1, Number(e.target.value) || 1) })} /></L>
                    <L t="Diária ao cliente (R$)"><input className={input} inputMode="decimal" defaultValue={l.unit ? String(l.unit).replace('.', ',') : ''} placeholder="0,00" onChange={e => mud(l.uid, { unit: num(e.target.value) })} /></L>
                    <button type="button" className={btnLeve} onClick={() => setLinhas(ls => ls.filter(x => x.uid !== l.uid))}>Remover</button>
                    {verMargem && (
                      <div className="sm:col-span-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                        {l.origem === 'terceiro' && (
                          <label className="flex items-center gap-1">Fornecedor:
                            <input className="w-36 rounded-lg border border-slate-300 px-2 py-1" value={l.fornecedor} onChange={e => mud(l.uid, { fornecedor: e.target.value })} />
                          </label>
                        )}
                        <label className="flex items-center gap-1">{l.origem === 'terceiro' ? 'Mensalidade paga (R$/mês):' : 'Custo mensal opcional (R$):'}
                          <Money v={l.custoMensal} on={n => mud(l.uid, { custoMensal: n })} />
                        </label>
                        <label className="flex items-center gap-1">Cobrança:
                          <select className="rounded-lg border border-slate-300 px-2 py-1" value={l.modo} onChange={e => mud(l.uid, { modo: e.target.value as Modo })}>
                            <option value="cheio">Mês cheio (30 dias)</option>
                            <option value="proporcional">Proporcional aos dias</option>
                          </select>
                        </label>
                        <span>Custo no prazo: <b>{brl(custoItem)}</b> ({meses.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mês)</span>
                        <span>Lucro do item: <b style={{ color: cor(lu) }}>{brl(lu)}</b></span>
                        {l.estoqueId && (() => { const a = proprios.find(p => p.id === l.estoqueId)?.aquisicao; return a ? <span className="text-slate-500">Valor de aquisição (referência): {brl(a)}</span> : null })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className={`${card} p-4`}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0d1b2e' }}>5. Frete, taxas e condições</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Frete cobrado do cliente (R$, entrega + retirada)"><Money v={ex.frete_cobrado} on={n => setE({ frete_cobrado: n })} cls="w-full" /></L>
            <L t="Taxas adicionais cobradas (R$)"><Money v={ex.taxa_cobrada} on={n => setE({ taxa_cobrada: n })} cls="w-full" /></L>
            {verMargem && <>
              <L t="Frete pago por você (R$, ida e volta) — não vai no PDF"><Money v={ex.frete_pago} on={n => setE({ frete_pago: n })} cls="w-full" /></L>
              <L t="Outros custos (R$: vistoria, lavagem, reparo…)"><Money v={ex.outros_custos} on={n => setE({ outros_custos: n })} cls="w-full" /></L>
              <L t="Impostos sobre a receita (%)"><Money v={ex.imposto_pct} on={n => setE({ imposto_pct: n })} cls="w-full" /></L>
              <L t="Comissão sobre a receita (%)"><Money v={ex.comissao_pct} on={n => setE({ comissao_pct: n })} cls="w-full" /></L>
            </>}
            <div className="sm:col-span-2"><L t="Condições de pagamento"><textarea className={input} rows={2} value={pagamento} onChange={e => setPagamento(e.target.value)} /></L></div>
            <div className="sm:col-span-2"><L t="Entrega / retirada"><textarea className={input} rows={2} value={frete} onChange={e => setFrete(e.target.value)} /></L></div>
            <div className="sm:col-span-2"><L t="Observações / responsabilidades"><textarea className={input} rows={3} value={obs} onChange={e => setObs(e.target.value)} /></L></div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
        <section className={`${card} p-4`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total para o cliente</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#0d1b2e' }}>{brl(r.receita)}</p>
          <p className="text-xs text-slate-500">{unidades} container(s) · {dias} dia(s) · aluguel {brl(r.alug)}{r.receita > r.alug ? ` + extras ${brl(r.receita - r.alug)}` : ''}</p>
          {verMargem && linhas.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 text-sm space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margem líquida (só você vê, não vai no PDF)</p>
              <div className="flex justify-between"><span>Receita</span><b>{brl(r.receita)}</b></div>
              <div className="flex justify-between"><span>− Containers de terceiros</span><b>{brl(r.custoTerc)}</b></div>
              {r.custoProp > 0 && <div className="flex justify-between"><span>− Custo dos próprios</span><b>{brl(r.custoProp)}</b></div>}
              <div className="flex justify-between"><span>− Frete pago</span><b>{brl(r.fretePago)}</b></div>
              <div className="flex justify-between"><span>− Outros custos</span><b>{brl(r.outros)}</b></div>
              {(r.imposto > 0 || r.comissao > 0) && <div className="flex justify-between"><span>− Impostos e comissão</span><b>{brl(r.imposto + r.comissao)}</b></div>}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-base">
                <span>Lucro líquido</span><b style={{ color: cor(r.lucro) }}>{brl(r.lucro)}</b>
              </div>
              <div className="flex justify-between"><span>Margem líquida</span><b style={{ color: cor(r.lucro) }}>{pct(r.margem)}</b></div>
              {r.markup != null && <div className="flex justify-between text-slate-500"><span>Markup sobre o custo</span><b>{pct(r.markup)}</b></div>}
              {r.diariaEmpate > 0 && <div className="flex justify-between text-slate-500"><span>Diária média para empatar</span><b>{brl(r.diariaEmpate)}</b></div>}
              {r.lucro < 0 && <p className="text-xs text-red-600 pt-1">Atenção: locação abaixo do custo total.</p>}
              {linhas.some(l => l.origem === 'terceiro' && l.modo === 'cheio') && dias < 30 &&
                <p className="text-[11px] text-amber-700 pt-1">Fornecedor com mês cheio: você paga os 30 dias mesmo locando só {dias}.</p>}
            </div>
          )}
          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
          {salva && <p className="text-sm text-green-700 mt-3">Proposta <b>{salva}</b> {inicial ? 'atualizada' : 'registrada'}. Veja em <a className="underline" href="/vendas/propostas">Propostas</a>.</p>}
          {bloqueada && <p className="text-sm text-amber-700 mt-3">Esta locação já foi fechada e não pode mais ser alterada.</p>}
          <button type="button" className={`${btn} w-full mt-4`} style={btnAzul} disabled={gerando || bloqueada} onClick={() => gerar(true)}>
            {gerando ? 'Salvando…' : inicial ? 'Salvar alterações e gerar PDF' : 'Registrar e gerar PDF'}
          </button>
          {inicial && <button type="button" className={`${btnLeve} w-full mt-2`} disabled={gerando || bloqueada} onClick={() => gerar(false)}>Salvar sem baixar PDF</button>}
        </section>
      </aside>
    </div>
  )
}
