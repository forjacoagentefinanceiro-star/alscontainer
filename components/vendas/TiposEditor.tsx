'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { salvarTipo, excluirTipo } from '@/app/(app)/vendas/actions'
import { brl, type Tipo } from '@/lib/vendas/config'
import { input, btn, btnAzul, btnLeve } from './ui'

export default function TiposEditor({ tipos, admin, usados }: { tipos: Tipo[]; admin: boolean; usados: Record<string, number> }) {
  const router = useRouter()
  const ref = useRef<HTMLFormElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pend, start] = useTransition()

  function enviar(fd: FormData) {
    setErro(null)
    start(async () => {
      const r = await salvarTipo(fd)
      if ('erro' in r) { setErro(r.erro); return }
      ref.current?.reset(); router.refresh()
    })
  }
  function editar(t: Tipo) {
    const f = ref.current; if (!f) return
    const set = (n: string, v: string) => { (f.elements.namedItem(n) as HTMLInputElement).value = v }
    set('codigo', t.codigo); set('nome', t.nome); set('descricao', t.descricao ?? ''); set('preco', String(t.preco).replace('.', ',')); set('ordem', String(t.ordem))
    f.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="space-y-4">
      {admin ? (
        <form ref={ref} action={enviar} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
          <label className="text-xs font-semibold text-slate-600">Código<input name="codigo" required maxLength={4} className={`${input} mt-1 w-20 uppercase`} placeholder="A" /></label>
          <label className="text-xs font-semibold text-slate-600">Nome<input name="nome" className={`${input} mt-1 w-40`} placeholder="Tipo A" /></label>
          <label className="text-xs font-semibold text-slate-600">Descrição<input name="descricao" className={`${input} mt-1 w-64`} placeholder="Ex.: melhor estado" /></label>
          <label className="text-xs font-semibold text-slate-600">Preço (R$)<input name="preco" required inputMode="decimal" className={`${input} mt-1 w-36`} placeholder="11.400,00" /></label>
          <label className="text-xs font-semibold text-slate-600">Ordem<input name="ordem" inputMode="numeric" defaultValue="0" className={`${input} mt-1 w-20`} /></label>
          <button disabled={pend} className={btn} style={btnAzul}>Salvar tipo</button>
          {erro && <span className="text-sm text-red-600">{erro}</span>}
        </form>
      ) : (
        <p className="text-sm text-slate-600">Somente o administrador altera tipos e preços.</p>
      )}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
            <th className="p-3">Tipo</th><th className="p-3">Nome</th><th className="p-3">Descrição</th><th className="p-3">Preço</th><th className="p-3">Containers</th><th className="p-3" />
          </tr></thead>
          <tbody>
            {tipos.map(t => (
              <tr key={t.codigo} className="border-b border-slate-100">
                <td className="p-3 font-bold text-base">{t.codigo}</td><td className="p-3">{t.nome}</td>
                <td className="p-3 text-slate-600">{t.descricao ?? '—'}</td><td className="p-3 font-semibold">{brl(t.preco)}</td>
                <td className="p-3">{usados[t.codigo] ?? 0}</td>
                <td className="p-3 flex gap-2">
                  {admin && <button className={btnLeve} onClick={() => editar(t)}>Editar</button>}
                  {admin && <button className={btnLeve} disabled={pend || (usados[t.codigo] ?? 0) > 0}
                    title={(usados[t.codigo] ?? 0) > 0 ? 'Há containers com este tipo' : undefined}
                    onClick={() => { if (confirm(`Remover o tipo ${t.codigo}?`)) start(async () => { await excluirTipo(t.codigo); router.refresh() }) }}>Remover</button>}
                </td>
              </tr>
            ))}
            {tipos.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Nenhum tipo. Rode <code>supabase/crm_vendas_tipos.sql</code> ou cadastre acima.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
