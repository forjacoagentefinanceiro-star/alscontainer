'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarLead, atualizarLead } from '@/app/(app)/vendas/actions'
import { CANAIS, USOS, type Lead, type Campanha } from '@/lib/vendas/config'
import { input, btn, btnAzul, btnLeve } from './ui'

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-slate-600">{t}<div className="mt-1 font-normal">{children}</div></label>
}

export default function LeadForm({ campanhas, lead, anos }: { campanhas: Campanha[]; lead?: Lead; anos: number[] }) {
  const [aberto, setAberto] = useState(!!lead)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [pend, start] = useTransition()
  const ref = useRef<HTMLFormElement>(null)
  const router = useRouter()

  if (!aberto) return <button className={btn} style={btnAzul} onClick={() => setAberto(true)}>+ Novo lead</button>

  function enviar(fd: FormData) {
    setErro(null); setSalvo(false)
    start(async () => {
      const r = lead ? await atualizarLead(lead.id, fd) : await criarLead(fd)
      if ('erro' in r) { setErro(r.erro); return }
      if (lead) { setSalvo(true); router.refresh() }
      else { ref.current?.reset(); setAberto(false); router.refresh() }
    })
  }

  return (
    <form ref={ref} action={enviar} className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 w-full">
      <L t="Nome *"><input name="nome" required defaultValue={lead?.nome} className={input} /></L>
      <L t="WhatsApp / telefone"><input name="telefone" inputMode="tel" defaultValue={lead?.telefone ?? ''} className={input} placeholder="(47) 99999-9999" /></L>
      <L t="Cidade"><input name="cidade" defaultValue={lead?.cidade ?? ''} className={input} /></L>
      <L t="Canal de origem">
        <select name="canal" defaultValue={lead?.canal ?? 'whatsapp'} className={input}>
          {CANAIS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </L>
      <L t="Campanha">
        <select name="campanha_id" defaultValue={lead?.campanha_id ?? ''} className={input}>
          <option value="">Nenhuma</option>
          {campanhas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </L>
      <L t="Vai usar para">
        <select name="uso" defaultValue={lead?.uso ?? ''} className={input}>
          <option value="">—</option>
          {USOS.map(u => <option key={u}>{u}</option>)}
        </select>
      </L>
      <L t="Ano do container">
        <input name="ano_pref" inputMode="numeric" list="anos-cv" defaultValue={lead?.ano_pref ?? ''} className={input} />
        <datalist id="anos-cv">{anos.map(a => <option key={a} value={a} />)}</datalist>
      </L>
      {lead && <L t="Valor negociado (R$)"><input name="preco" inputMode="decimal" defaultValue={lead.preco ? String(lead.preco).replace('.', ',') : ''} className={input} /></L>}
      <L t="Responsável"><input name="responsavel" defaultValue={lead?.responsavel ?? ''} className={input} /></L>
      <div className="sm:col-span-2 lg:col-span-3">
        <L t="Observações"><textarea name="obs" rows={2} defaultValue={lead?.obs ?? ''} className={input} /></L>
      </div>
      <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-2">
        <button disabled={pend} className={btn} style={btnAzul}>{pend ? 'Salvando…' : lead ? 'Salvar' : 'Criar lead'}</button>
        {!lead && <button type="button" className={btnLeve} onClick={() => setAberto(false)}>Cancelar</button>}
        {salvo && <span className="text-sm text-green-700">Salvo</span>}
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>
    </form>
  )
}
