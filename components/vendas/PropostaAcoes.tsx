'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { gerarPropostaPdf, baixarBlob } from '@/lib/vendas/propostaPdf'
import { converterProposta, marcarProposta, type ItemSalvo } from '@/app/(app)/vendas/propostas-actions'
import { btnLeve } from './ui'

export type PropostaRow = {
  id: string; codigo: string; cliente_nome: string; telefone: string | null; email: string | null; documento: string | null
  cidade: string | null; lead_id: string | null; itens: ItemSalvo[]; total: number; validade: string
  pagamento: string | null; frete: string | null; observacoes: string | null; ilustrativas: boolean
  status: string; criado_em: string
  tipo?: string; dias?: number | null; extras?: { inicio?: string; frete_cobrado?: number; taxa_cobrada?: number }
}
const dataBr = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export default function PropostaAcoes({ p }: { p: PropostaRow }) {
  const [pend, start] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const router = useRouter()

  async function pdf() {
    setErro(null)
    try {
      const { blob, nome } = await gerarPropostaPdf({
        numero: p.codigo, emissao: dataBr(p.criado_em), validade: dataBr(p.validade + 'T12:00:00'),
        cliente: { nome: p.cliente_nome, telefone: p.telefone ?? '', email: p.email ?? '', documento: p.documento ?? '', cidade: p.cidade ?? '' },
        itens: p.itens.map(i => ({ descricao: i.descricao, detalhe: i.detalhe, qtd: i.qtd, unit: i.unit, numero: i.numero, ano: i.ano })),
        pagamento: p.pagamento ?? '', frete: p.frete ?? '', observacoes: p.observacoes ?? '', ilustrativas: p.ilustrativas,
        locacao: p.tipo === 'locacao' ? {
          dias: p.dias ?? 1, inicio: p.extras?.inicio ? dataBr(p.extras.inicio + 'T12:00:00') : '',
          extras: [
            ...(p.extras?.frete_cobrado ? [{ rotulo: 'Frete (entrega e retirada)', valor: p.extras.frete_cobrado }] : []),
            ...(p.extras?.taxa_cobrada ? [{ rotulo: 'Taxas adicionais', valor: p.extras.taxa_cobrada }] : []),
          ],
        } : undefined,
      })
      baixarBlob(blob, nome)
    } catch (e) { setErro((e as Error).message) }
  }
  const rodar = (f: () => Promise<{ ok: true } | { erro: string }>) => start(async () => {
    setErro(null); const r = await f(); if ('erro' in r) setErro(r.erro); else router.refresh()
  })

  return (
    <div className="flex flex-col gap-1 items-start">
      <Link href={`/vendas/propostas/${p.id}`} className={btnLeve}>{p.status === 'vendida' ? 'Abrir' : 'Abrir / editar'}</Link>
      <button className={btnLeve} onClick={pdf}>Baixar PDF</button>
      {p.status === 'aberta' && (
        <>
          <button className={btnLeve} disabled={pend} style={{ color: '#16a34a' }}
            onClick={() => { if (confirm(p.tipo === 'locacao' ? `Fechar a locação ${p.codigo}? Os containers próprios serão marcados como locados.` : `Converter a proposta ${p.codigo} em VENDA? Os containers do estoque serão baixados como vendidos.`)) rodar(() => converterProposta(p.id)) }}>
            {p.tipo === 'locacao' ? 'Fechar locação' : 'Converter em venda'}
          </button>
          <button className={btnLeve} disabled={pend} onClick={() => rodar(() => marcarProposta(p.id, 'perdida'))}>Marcar perdida</button>
        </>
      )}
      {p.status === 'perdida' && <button className={btnLeve} disabled={pend} onClick={() => rodar(() => marcarProposta(p.id, 'aberta'))}>Reabrir</button>}
      {erro && <p className="text-xs text-red-600 max-w-[220px]">{erro}</p>}
    </div>
  )
}
