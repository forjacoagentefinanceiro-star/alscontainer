'use client'

import { useMemo, useState } from 'react'
import { brl } from '@/lib/vendas/config'
import { gerarPropostaPdf, type PropItem } from '@/lib/vendas/propostaPdf'
import { card, input, btn, btnAzul, btnLeve } from './ui'

export type ItemEstoque = {
  id: string; numero: string; tamanho: string; ano: number | null; tipo: string | null
  preco: number | null; custo: number | null   // custo só vem preenchido para admin
}
type Cliente = { nome: string; telefone: string; email: string; documento: string; cidade: string }

// Preços "a partir de" (sugestão editável) para itens avulsos sem número
const MODELOS = [
  { key: '20', nome: 'Container 20 pés', preco: 6500 },
  { key: '40dry', nome: 'Container 40 pés Dry', preco: 8200 },
  { key: '40hc', nome: 'Container 40 pés High Cube (HC)', preco: 8500 },
]

type Linha = {
  uid: string; estoqueId: string | null; descricao: string; detalhe: string
  qtd: number; unit: number; custo: number | null   // custo unitário (aquisição)
}

const num = (v: string) => { const n = Number(v.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0 }
const dataBr = (d: Date) => d.toLocaleDateString('pt-BR')
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600">{t}<div className="mt-1 font-normal">{children}</div></label>
}

export default function PropostaForm({ estoque, cliente: c0, verMargem }: { estoque: ItemEstoque[]; cliente: Cliente; verMargem: boolean }) {
  const [cli, setCli] = useState<Cliente>(c0)
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [validade, setValidade] = useState(7)
  const [pagamento, setPagamento] = useState('À vista (Pix ou transferência), com 30% de sinal para reservar a unidade e o restante na retirada.')
  const [frete, setFrete] = useState('Frete sob consulta. Retirada no pátio em Itajaí/SC sem custo.')
  const [obs, setObs] = useState('')
  const [ilustrativas, setIlustrativas] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const sel = useMemo(() => new Set(linhas.map(l => l.estoqueId).filter(Boolean)), [linhas])

  function alternar(i: ItemEstoque) {
    setLinhas(ls => sel.has(i.id)
      ? ls.filter(l => l.estoqueId !== i.id)
      : [...ls, {
        uid: i.id, estoqueId: i.id,
        descricao: `Container ${i.tamanho} usado · nº ${i.numero}`,
        detalhe: [i.ano ? `Ano ${i.ano}` : '', 'Retirada no pátio em Itajaí/SC'].filter(Boolean).join(' · '),
        qtd: 1, unit: i.preco ?? 0, custo: verMargem ? i.custo : null,
      }])
  }
  function avulso(m: (typeof MODELOS)[number]) {
    setLinhas(ls => [...ls, {
      uid: `av-${Date.now()}-${ls.length}`, estoqueId: null, descricao: `${m.nome} usado`,
      detalhe: 'Condição a combinar · Retirada no pátio em Itajaí/SC', qtd: 1, unit: m.preco, custo: verMargem ? 0 : null,
    }])
  }
  const mud = (uid: string, p: Partial<Linha>) => setLinhas(ls => ls.map(l => l.uid === uid ? { ...l, ...p } : l))

  const total = linhas.reduce((s, l) => s + l.qtd * l.unit, 0)
  const custoTotal = linhas.reduce((s, l) => s + l.qtd * (l.custo ?? 0), 0)
  const lucro = total - custoTotal
  const margem = total > 0 ? (lucro / total) * 100 : 0
  const markup = custoTotal > 0 ? (lucro / custoTotal) * 100 : null

  async function gerar() {
    setErro(null)
    if (!cli.nome.trim()) return setErro('Informe o nome do cliente.')
    if (!linhas.length) return setErro('Selecione ao menos um container.')
    if (linhas.some(l => l.qtd < 1 || l.unit <= 0)) return setErro('Confira quantidade e valor unitário de todos os itens.')
    setGerando(true)
    try {
      const hoje = new Date(); const val = new Date(hoje.getTime() + validade * 86400000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const numero = `${hoje.getFullYear()}${pad(hoje.getMonth() + 1)}${pad(hoje.getDate())}-${pad(hoje.getHours())}${pad(hoje.getMinutes())}`
      const itens: PropItem[] = linhas.map(l => ({ descricao: l.descricao, detalhe: l.detalhe, qtd: l.qtd, unit: l.unit }))
      const { blob, nome } = await gerarPropostaPdf({
        numero, emissao: dataBr(hoje), validade: dataBr(val), cliente: cli, itens,
        pagamento, frete, observacoes: obs, ilustrativas,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (e) { setErro(`Não foi possível gerar o PDF: ${(e as Error).message}`) }
    setGerando(false)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
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
          <h2 className="font-bold text-sm mb-1" style={{ color: '#0d1b2e' }}>2. Containers do estoque</h2>
          <p className="text-xs text-slate-500 mb-3">Marque os containers que entram na proposta. O preço sugerido vem do tipo (A/B/C) e pode ser editado abaixo.</p>
          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {estoque.map(i => (
              <label key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={sel.has(i.id)} onChange={() => alternar(i)} />
                <span className="font-mono font-semibold">{i.numero}</span>
                <span className="text-slate-600">{i.tamanho}{i.ano ? ` · ${i.ano}` : ''}{i.tipo ? ` · tipo ${i.tipo}` : ''}</span>
                <span className="ml-auto font-semibold">{i.preco ? brl(i.preco) : '—'}</span>
              </label>
            ))}
            {estoque.length === 0 && <p className="p-4 text-sm text-slate-500">Nenhum container marcado para venda no estoque.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-slate-500">Item sem número (por tipo):</span>
            {MODELOS.map(m => <button key={m.key} type="button" className={btnLeve} onClick={() => avulso(m)}>+ {m.nome.replace('Container ', '')}</button>)}
          </div>
        </section>

        {linhas.length > 0 && (
          <section className={`${card} p-4`}>
            <h2 className="font-bold text-sm mb-3" style={{ color: '#0d1b2e' }}>3. Itens da proposta</h2>
            <div className="space-y-3">
              {linhas.map(l => {
                const lu = l.unit - (l.custo ?? 0)
                const mg = l.unit > 0 ? (lu / l.unit) * 100 : 0
                return (
                  <div key={l.uid} className="border border-slate-200 rounded-xl p-3 grid gap-2 sm:grid-cols-[1fr_80px_130px_auto] items-end">
                    <div className="space-y-1">
                      <input className={input} value={l.descricao} onChange={e => mud(l.uid, { descricao: e.target.value })} />
                      <input className={`${input} text-xs`} value={l.detalhe} onChange={e => mud(l.uid, { detalhe: e.target.value })} placeholder="Detalhe (ano, condição…)" />
                    </div>
                    <L t="Qtd"><input className={input} type="number" min={1} value={l.qtd} onChange={e => mud(l.uid, { qtd: Math.max(1, Number(e.target.value) || 1) })} /></L>
                    <L t="Valor unitário (R$)"><input className={input} inputMode="decimal" defaultValue={String(l.unit).replace('.', ',')} onChange={e => mud(l.uid, { unit: num(e.target.value) })} /></L>
                    <button type="button" className={btnLeve} onClick={() => setLinhas(ls => ls.filter(x => x.uid !== l.uid))}>Remover</button>
                    {verMargem && (
                      <div className="sm:col-span-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs bg-slate-50 rounded-lg px-3 py-2">
                        {l.estoqueId ? (
                          <span>Aquisição: <b>{brl(l.custo ?? 0)}</b></span>
                        ) : (
                          <label className="flex items-center gap-1">Aquisição (R$):
                            <input className="w-28 rounded-lg border border-slate-300 px-2 py-1" inputMode="decimal"
                              defaultValue={String(l.custo ?? 0).replace('.', ',')} onChange={e => mud(l.uid, { custo: num(e.target.value) })} />
                          </label>
                        )}
                        <span>Lucro/un: <b style={{ color: lu < 0 ? '#dc2626' : '#16a34a' }}>{brl(lu)}</b></span>
                        <span>Margem: <b style={{ color: lu < 0 ? '#dc2626' : '#16a34a' }}>{pct(mg)}</b></span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <section className={`${card} p-4`}>
          <h2 className="font-bold text-sm mb-3" style={{ color: '#0d1b2e' }}>4. Condições</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <L t="Validade da proposta (dias)"><input className={input} type="number" min={1} value={validade} onChange={e => setValidade(Math.max(1, Number(e.target.value) || 1))} /></L>
            <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" checked={ilustrativas} onChange={e => setIlustrativas(e.target.checked)} /> Incluir aviso “imagens ilustrativas”</label>
            <div className="sm:col-span-2"><L t="Condições de pagamento"><textarea className={input} rows={2} value={pagamento} onChange={e => setPagamento(e.target.value)} /></L></div>
            <div className="sm:col-span-2"><L t="Frete / entrega"><textarea className={input} rows={2} value={frete} onChange={e => setFrete(e.target.value)} /></L></div>
            <div className="sm:col-span-2"><L t="Observações"><textarea className={input} rows={2} value={obs} onChange={e => setObs(e.target.value)} /></L></div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
        <section className={`${card} p-4`}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total da proposta</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#0d1b2e' }}>{brl(total)}</p>
          <p className="text-xs text-slate-500">{linhas.reduce((s, l) => s + l.qtd, 0)} container(s)</p>
          {verMargem && linhas.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-200 text-sm space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Margem (só você vê, não vai no PDF)</p>
              <div className="flex justify-between"><span>Venda</span><b>{brl(total)}</b></div>
              <div className="flex justify-between"><span>− Aquisição</span><b>{brl(custoTotal)}</b></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 text-base">
                <span>Lucro</span><b style={{ color: lucro < 0 ? '#dc2626' : '#16a34a' }}>{brl(lucro)}</b>
              </div>
              <div className="flex justify-between"><span>Margem sobre a venda</span><b style={{ color: lucro < 0 ? '#dc2626' : '#16a34a' }}>{pct(margem)}</b></div>
              {markup != null && <div className="flex justify-between text-slate-500"><span>Markup sobre o custo</span><b>{pct(markup)}</b></div>}
              {lucro < 0 && <p className="text-xs text-red-600 pt-1">Atenção: venda abaixo do custo de aquisição.</p>}
              <p className="text-[11px] text-slate-400 pt-1">Aquisição = valor de compra do container (sem despesas lançadas).</p>
            </div>
          )}
          {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
          <button type="button" className={`${btn} w-full mt-4`} style={btnAzul} disabled={gerando} onClick={gerar}>
            {gerando ? 'Gerando…' : 'Gerar PDF da proposta'}
          </button>
        </section>
      </aside>
    </div>
  )
}
