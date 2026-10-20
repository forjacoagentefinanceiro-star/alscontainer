'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { salvarPreco, excluirPreco } from '@/app/(app)/vendas/actions'
import { brl, type Preco } from '@/lib/vendas/config'
import { input, btn, btnAzul, btnLeve } from './ui'

export default function PrecosEditor({ precos }: { precos: Preco[] }) {
  const router = useRouter()
  const ref = useRef<HTMLFormElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pend, start] = useTransition()

  function enviar(fd: FormData) {
    setErro(null)
    start(async () => {
      const r = await salvarPreco(fd)
      if ('erro' in r) { setErro(r.erro); return }
      ref.current?.reset(); router.refresh()
    })
  }
  function editar(p: Preco) {
    const f = ref.current; if (!f) return
    ;(f.elements.namedItem('ano') as HTMLInputElement).value = String(p.ano)
    ;(f.elements.namedItem('preco') as HTMLInputElement).value = String(p.preco).replace('.', ',')
    ;(f.elements.namedItem('unidades') as HTMLInputElement).value = String(p.unidades)
    f.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="space-y-4">
      <form ref={ref} action={enviar} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">Ano do container<input name="ano" inputMode="numeric" required className={`${input} mt-1 w-32`} /></label>
        <label className="text-xs font-semibold text-slate-600">Preço (R$)<input name="preco" inputMode="decimal" required className={`${input} mt-1 w-40`} placeholder="10.300,00" /></label>
        <label className="text-xs font-semibold text-slate-600">Unidades disponíveis<input name="unidades" inputMode="numeric" defaultValue="0" className={`${input} mt-1 w-40`} /></label>
        <button disabled={pend} className={btn} style={btnAzul}>Salvar ano</button>
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </form>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="p-3">Ano</th><th className="p-3">Preço</th><th className="p-3">Disponíveis</th><th className="p-3">Vendidas</th><th className="p-3" />
          </tr></thead>
          <tbody>
            {precos.map(p => (
              <tr key={p.ano} className="border-b border-slate-100">
                <td className="p-3 font-semibold">{p.ano}</td><td className="p-3">{brl(p.preco)}</td>
                <td className="p-3">{p.unidades}</td><td className="p-3">{p.vendidas}</td>
                <td className="p-3 flex gap-2">
                  <button className={btnLeve} onClick={() => editar(p)}>Editar</button>
                  <button className={btnLeve} disabled={pend} onClick={() => { if (confirm(`Remover o ano ${p.ano}?`)) start(async () => { await excluirPreco(p.ano); router.refresh() }) }}>Remover</button>
                </td>
              </tr>
            ))}
            {precos.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">Cadastre os anos e preços das unidades.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
