'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { concluirTarefa, adiarTarefa } from '@/app/(app)/vendas/actions'
import { dataHora, formatTelefone } from '@/lib/vendas/config'
import { abrirWhats } from '@/lib/vendas/abrirWhats'
import { btnLeve } from './ui'

export type LinhaAgenda = { id: string; lead_id: string; titulo: string; vence_em: string; nome: string; telefone: string | null; atrasada: boolean }

export default function AgendaLista({ linhas }: { linhas: LinhaAgenda[] }) {
  const router = useRouter()
  const [pend, start] = useTransition()
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh() })

  if (linhas.length === 0) return <p className="text-sm text-slate-500">Nenhuma tarefa em aberto.</p>
  return (
    <ul className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200">
      {linhas.map(t => (
        <li key={t.id} className="p-3 flex flex-wrap items-center gap-2 text-sm cursor-pointer hover:bg-slate-50"
          onClick={e => { if ((e.target as HTMLElement).closest('button')) return; router.push(`/vendas/leads/${t.lead_id}`) }}>
          <div className="flex-1 min-w-[200px]">
            <p className="font-medium text-slate-900">{t.titulo}</p>
            <p className="text-xs text-slate-500">{t.nome}{t.telefone ? ` · ${formatTelefone(t.telefone)}` : ''}</p>
          </div>
          <span className="text-xs font-semibold" style={{ color: t.atrasada ? '#dc2626' : '#64748b' }}>{t.atrasada ? 'Atrasada · ' : ''}{dataHora(t.vence_em)}</span>
          {t.telefone && <button className={btnLeve} onClick={() => abrirWhats(t.telefone)}>WhatsApp</button>}
          <button className={btnLeve} disabled={pend} onClick={() => run(() => concluirTarefa(t.id))}>Feita</button>
          <button className={btnLeve} disabled={pend} onClick={() => run(() => adiarTarefa(t.id, 1))}>+1 dia</button>
          <button className={btnLeve} disabled={pend} onClick={() => run(() => adiarTarefa(t.id, 3))}>+3 dias</button>
        </li>
      ))}
    </ul>
  )
}
