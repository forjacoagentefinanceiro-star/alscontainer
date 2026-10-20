'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registrarWhats, adicionarNota, criarTarefa, concluirTarefa, adiarTarefa, excluirLead } from '@/app/(app)/vendas/actions'
import { MODELOS, dataHora, type Lead, type Tarefa } from '@/lib/vendas/config'
import { abrirWhats, destinoWhats, salvarDestinoWhats, type DestinoWhats } from '@/lib/vendas/abrirWhats'
import { input, btn, btnAzul, btnVerde, btnLeve } from './ui'

export default function LeadAcoes({ lead, tarefas, precoTxt }: { lead: Lead; tarefas: Tarefa[]; precoTxt?: string }) {
  const router = useRouter()
  const [pend, start] = useTransition()
  const [modelo, setModelo] = useState(MODELOS[0].key)
  const [texto, setTexto] = useState(() => MODELOS[0].texto(lead, precoTxt))
  const [destino, setDestino] = useState<DestinoWhats>(() => (typeof window === 'undefined' ? 'web' : destinoWhats()))
  const [nota, setNota] = useState('')
  const [tTitulo, setTTitulo] = useState('')
  const [tData, setTData] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  function trocarModelo(k: string) {
    setModelo(k)
    const m = MODELOS.find(x => x.key === k)
    if (m) setTexto(m.texto(lead, precoTxt))
  }
  function enviar() {
    if (!abrirWhats(lead.telefone, texto)) { setErro('Telefone inválido para WhatsApp.'); return }
    setErro(null)
    const titulo = MODELOS.find(m => m.key === modelo)?.titulo ?? 'Mensagem'
    start(async () => { await registrarWhats(lead.id, titulo, texto); router.refresh() })
  }
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh() })
  const [agora] = useState(() => Date.now())
  const abertas = tarefas.filter(t => !t.concluida_em)

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <h2 className="font-bold text-sm mb-2" style={{ color: '#0d1b2e' }}>Próxima mensagem (WhatsApp)</h2>
        <select className={input} value={modelo} onChange={e => trocarModelo(e.target.value)}>
          {MODELOS.map(m => <option key={m.key} value={m.key}>{m.titulo}</option>)}
        </select>
        <textarea className={`${input} mt-2`} rows={5} value={texto} onChange={e => setTexto(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button disabled={pend || !lead.telefone} onClick={enviar} className={btn} style={{ background: '#25D366' }}>
            Enviar pelo WhatsApp
          </button>
          <select value={destino} onChange={e => { const d = e.target.value as DestinoWhats; setDestino(d); salvarDestinoWhats(d) }}
            className="text-xs rounded-lg border border-slate-300 py-1.5 px-2 bg-white" aria-label="Enviar pelo">
            <option value="web">WhatsApp Web (aba nova)</option>
            <option value="app">App do Windows</option>
            <option value="copiar">Só copiar o texto</option>
          </select>
          {!lead.telefone && <span className="text-xs text-red-600">Sem telefone cadastrado</span>}
          {erro && <span className="text-xs text-red-600">{erro}</span>}
        </div>
        <p className="text-xs text-slate-500 mt-1">O texto enviado fica gravado no histórico do lead.</p>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <h2 className="font-bold text-sm mb-2" style={{ color: '#0d1b2e' }}>Tarefas em aberto</h2>
        {abertas.length === 0 && <p className="text-sm text-slate-500">Nenhuma tarefa aberta.</p>}
        <ul className="space-y-2">
          {abertas.map(t => {
            const atrasada = new Date(t.vence_em).getTime() < agora
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="flex-1 min-w-[160px]">{t.titulo}</span>
                <span className="text-xs" style={{ color: atrasada ? '#dc2626' : '#64748b' }}>{atrasada ? 'atrasada · ' : ''}{dataHora(t.vence_em)}</span>
                <button className={btnLeve} disabled={pend} onClick={() => run(() => concluirTarefa(t.id))}>Feita</button>
                <button className={btnLeve} disabled={pend} onClick={() => run(() => adiarTarefa(t.id, 1))}>+1 dia</button>
              </li>
            )
          })}
        </ul>
        <form className="flex flex-wrap gap-2 mt-3" onSubmit={e => { e.preventDefault(); run(async () => { await criarTarefa(lead.id, tTitulo, tData); setTTitulo(''); setTData('') }) }}>
          <input className={`${input} flex-1 min-w-[160px]`} placeholder="Nova tarefa" value={tTitulo} onChange={e => setTTitulo(e.target.value)} />
          <input type="datetime-local" className={`${input} w-auto`} value={tData} onChange={e => setTData(e.target.value)} />
          <button className={btn} style={btnAzul} disabled={pend || !tTitulo || !tData}>Agendar</button>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <h2 className="font-bold text-sm mb-2" style={{ color: '#0d1b2e' }}>Anotação</h2>
        <textarea className={input} rows={2} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ex.: cliente vem sábado ver o container" />
        <button className={`${btn} mt-2`} style={btnVerde} disabled={pend || !nota.trim()}
          onClick={() => run(async () => { await adicionarNota(lead.id, nota); setNota('') })}>Salvar anotação</button>
      </section>

      <button className="text-xs text-red-600 underline" disabled={pend}
        onClick={() => { if (confirm('Excluir este lead e todo o histórico?')) run(async () => { await excluirLead(lead.id); router.push('/vendas') }) }}>
        Excluir lead
      </button>
    </div>
  )
}
