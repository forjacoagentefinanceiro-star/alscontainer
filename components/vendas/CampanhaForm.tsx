'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { salvarCampanha, excluirCampanha } from '@/app/(app)/vendas/actions'
import { CANAIS, type Campanha } from '@/lib/vendas/config'
import { input, btn, btnAzul, btnLeve } from './ui'

export function CampanhaForm({ campanha, onFechar }: { campanha?: Campanha; onFechar?: () => void }) {
  const router = useRouter()
  const ref = useRef<HTMLFormElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pend, start] = useTransition()

  function enviar(fd: FormData) {
    setErro(null)
    start(async () => {
      const r = await salvarCampanha(fd)
      if ('erro' in r) { setErro(r.erro); return }
      ref.current?.reset(); onFechar?.(); router.refresh()
    })
  }

  return (
    <form ref={ref} action={enviar} className="bg-white rounded-2xl border border-slate-200 p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {campanha && <input type="hidden" name="id" value={campanha.id} />}
      <input name="nome" required placeholder="Nome da campanha" defaultValue={campanha?.nome} className={input} />
      <select name="canal" defaultValue={campanha?.canal ?? 'marketplace'} className={input}>
        {CANAIS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <input name="verba" inputMode="decimal" placeholder="Gasto total (R$)" defaultValue={campanha ? String(campanha.verba).replace('.', ',') : ''} className={input} />
      <input name="link" placeholder="Link do anúncio" defaultValue={campanha?.link ?? ''} className={input} />
      <label className="text-xs text-slate-600">Início<input type="date" name="inicio" defaultValue={campanha?.inicio ?? ''} className={input} /></label>
      <label className="text-xs text-slate-600">Fim<input type="date" name="fim" defaultValue={campanha?.fim ?? ''} className={input} /></label>
      <input name="utm" placeholder="UTM / observação" defaultValue={campanha?.utm ?? ''} className={input} />
      <label className="text-xs text-slate-600 flex items-end gap-2 pb-2">
        <input type="checkbox" name="ativa" value="on" defaultChecked={campanha?.ativa ?? true} /> Ativa
      </label>
      <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
        <button disabled={pend} className={btn} style={btnAzul}>{pend ? 'Salvando…' : campanha ? 'Salvar' : 'Criar campanha'}</button>
        {onFechar && <button type="button" className={btnLeve} onClick={onFechar}>Cancelar</button>}
        {campanha && (
          <button type="button" className="ml-auto text-xs text-red-600 underline" disabled={pend}
            onClick={() => { if (confirm('Excluir a campanha? Os leads ficam, sem campanha.')) start(async () => { await excluirCampanha(campanha.id); router.refresh() }) }}>
            Excluir
          </button>
        )}
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>
    </form>
  )
}

export function EditarCampanha({ campanha }: { campanha: Campanha }) {
  const [aberto, setAberto] = useState(false)
  if (!aberto) return <button className={btnLeve} onClick={() => setAberto(true)}>Editar</button>
  return <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(13,27,46,.55)' }}>
    <div className="w-full max-w-3xl mt-10"><CampanhaForm campanha={campanha} onFechar={() => setAberto(false)} /></div>
  </div>
}

export function NovaCampanha() {
  const [aberto, setAberto] = useState(false)
  if (!aberto) return <button className={btn} style={btnAzul} onClick={() => setAberto(true)}>+ Nova campanha</button>
  return <div className="w-full"><CampanhaForm onFechar={() => setAberto(false)} /></div>
}
