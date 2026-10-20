'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { MessageCircle } from 'lucide-react'
import { moverEtapa } from '@/app/(app)/vendas/actions'
import { ETAPAS, CANAL_LABEL, brl, diasDesde, formatTelefone, type Lead } from '@/lib/vendas/config'
import { abrirWhats } from '@/lib/vendas/abrirWhats'
import { input, btn, btnAzul, btnLeve } from './ui'

const MOTIVOS = ['Preço', 'Comprou em outro lugar', 'Sem resposta', 'Frete/localização', 'Desistiu do projeto', 'Outro']

export default function Kanban({ leads: inicial, numeros }: { leads: Lead[]; numeros: Record<string, string> }) {
  const [leads, setLeads] = useState(inicial)
  const [base, setBase] = useState(inicial)
  const [agora] = useState(() => Date.now())
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [fechar, setFechar] = useState<{ id: string; etapa: 'vendido' | 'perdido' } | null>(null)
  const [motivo, setMotivo] = useState(MOTIVOS[0])
  const [valor, setValor] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [, start] = useTransition()

  if (base !== inicial) { setBase(inicial); setLeads(inicial) }

  function aplicar(id: string, etapa: string, extra?: { motivo?: string; preco?: number | null }) {
    const antes = leads
    setLeads(ls => ls.map(l => (l.id === id ? { ...l, etapa, ...(extra?.preco != null ? { preco: extra.preco } : {}) } : l)))
    start(async () => {
      const r = await moverEtapa(id, etapa, extra)
      if ('erro' in r) { setErro(r.erro); setLeads(antes) } else setErro(null)
    })
  }
  function mover(id: string, etapa: string) {
    const l = leads.find(x => x.id === id)
    if (!l || l.etapa === etapa) return
    if (etapa === 'vendido' || etapa === 'perdido') {
      setValor(l.preco ? String(l.preco).replace('.', ',') : '')
      setFechar({ id, etapa }); return
    }
    aplicar(id, etapa)
  }
  function confirmar() {
    if (!fechar) return
    if (fechar.etapa === 'perdido') aplicar(fechar.id, 'perdido', { motivo })
    else {
      const n = Number(valor.replace(/\./g, '').replace(',', '.'))
      aplicar(fechar.id, 'vendido', { preco: Number.isFinite(n) && valor ? n : null })
    }
    setFechar(null)
  }

  return (
    <>
      {erro && <p className="mb-3 text-sm text-red-600">{erro}</p>}
      <div className="flex gap-3 overflow-x-auto pb-3 items-start">
        {ETAPAS.map(e => {
          const col = leads.filter(l => l.etapa === e.key)
          return (
            <div key={e.key}
              onDragOver={ev => { ev.preventDefault(); setSobre(e.key) }}
              onDragLeave={() => setSobre(null)}
              onDrop={() => { const id = arrastando; setArrastando(null); setSobre(null); if (id) mover(id, e.key) }}
              className="shrink-0 rounded-2xl p-2"
              style={{ width: 252, background: sobre === e.key ? '#e0ecfa' : '#e8ecf2' }}>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: e.cor }}>{e.label}</span>
                <span className="text-xs text-slate-500">{col.length}</span>
              </div>
              <div className="space-y-2">
                {col.map(l => (
                  <div key={l.id} draggable onDragStart={() => setArrastando(l.id)} onDragEnd={() => setArrastando(null)}
                    className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm cursor-grab">
                    <Link href={`/vendas/leads/${l.id}`} className="block">
                      <p className="font-semibold text-sm text-slate-900 truncate">{l.nome}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {CANAL_LABEL[l.canal] ?? l.canal}{l.cidade ? ` · ${l.cidade}` : ''}
                      </p>
                      {l.container_id && numeros[l.container_id] && <p className="text-xs font-mono text-slate-600 mt-1">{numeros[l.container_id]}</p>}
                      {(l.ano_pref || l.preco) && (
                        <p className="text-xs text-slate-600 mt-1">{l.ano_pref ? `Ano ${l.ano_pref}` : ''}{l.ano_pref && l.preco ? ' · ' : ''}{l.preco ? brl(l.preco) : ''}</p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1">
                        {diasDesde(l.atualizado_em, agora) === 0 ? 'atualizado hoje' : `parado há ${diasDesde(l.atualizado_em, agora)} d`}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2 mt-2">
                      {l.telefone && (
                        <button type="button" title={formatTelefone(l.telefone)}
                          onClick={() => abrirWhats(l.telefone)}
                          className="p-1.5 rounded-lg text-white" style={{ background: '#25D366' }}>
                          <MessageCircle size={14} />
                        </button>
                      )}
                      <select value={l.etapa} onChange={ev => mover(l.id, ev.target.value)}
                        className="flex-1 text-xs rounded-lg border border-slate-300 py-1 px-1.5 bg-white" aria-label="Mover para etapa">
                        {ETAPAS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {col.length === 0 && <p className="text-xs text-slate-400 px-2 py-3">Sem leads</p>}
              </div>
            </div>
          )
        })}
      </div>

      {fechar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(13,27,46,.55)' }} onClick={() => setFechar(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            {fechar.etapa === 'perdido' ? (
              <>
                <h3 className="font-bold mb-3">Por que o lead foi perdido?</h3>
                <select className={input} value={motivo} onChange={e => setMotivo(e.target.value)}>
                  {MOTIVOS.map(m => <option key={m}>{m}</option>)}
                </select>
              </>
            ) : (
              <>
                <h3 className="font-bold mb-3">Venda fechada: qual o valor final?</h3>
                <input className={input} inputMode="decimal" placeholder="Ex.: 10.800,00" value={valor} onChange={e => setValor(e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Se o lead tem ano definido, uma unidade sai do estoque desse ano.</p>
              </>
            )}
            <div className="flex gap-2 mt-4 justify-end">
              <button className={btnLeve} onClick={() => setFechar(null)}>Cancelar</button>
              <button className={btn} style={btnAzul} onClick={confirmar}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
