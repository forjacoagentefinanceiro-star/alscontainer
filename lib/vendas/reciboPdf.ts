// Recibo de pagamento — gerado no navegador (jsPDF)
import type { jsPDF as JsPDF } from 'jspdf'

const TXT = '#111418', MUDO = '#5f6670', AZUL = '#1B4F8A', LINHA = '#d5d8dc', FAIXA = '#f3f4f6'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export type ReciboDados = {
  numero: string            // ex: RC-PD-2026-0001-1
  clienteNome: string
  valor: number
  forma: string             // pix, transferencia, dinheiro…
  dataRecebimento: string   // yyyy-mm-dd
  pedidoCodigo: string
  containers: { numero: string; tamanho: string }[]
  totalPedido: number
  totalPagoApos: number     // total_pago depois deste pagamento
  obs: string | null
}

const FORMA_LABEL: Record<string, string> = {
  pix: 'Pix', transferencia: 'Transferência bancária', dinheiro: 'Dinheiro',
  cartao: 'Cartão', cheque: 'Cheque', outro: 'Outro',
}

async function carregarLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch('/containers/mla-logo.png')).blob()
    const data: string = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob)
    })
    const im: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = data
    })
    const esc = Math.min(1, 400 / im.naturalWidth)
    const cv = document.createElement('canvas')
    cv.width = Math.round(im.naturalWidth * esc); cv.height = Math.round(im.naturalHeight * esc)
    cv.getContext('2d')!.drawImage(im, 0, 0, cv.width, cv.height)
    return { data: cv.toDataURL('image/png'), w: cv.width, h: cv.height }
  } catch { return null }
}

export async function gerarReciboPdf(d: ReciboDados): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import('jspdf')
  const doc: JsPDF = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, M = 15, CW = W - 2 * M
  const logo = await carregarLogo()

  const cor = (c: string) => doc.setTextColor(c)
  const fonte = (bold: boolean, size: number) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size) }

  const dataFmt = new Date(d.dataRecebimento + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const saldo = Math.max(0, d.totalPedido - d.totalPagoApos)

  // ── Cabeçalho ──
  let y = 13
  if (logo) {
    const lh = 18, lw = (logo.w / logo.h) * lh
    doc.addImage(logo.data, 'PNG', M, y, lw, lh)
  } else {
    fonte(true, 16); cor(AZUL); doc.text('MLA CONTAINERS', M, y + 10)
  }
  fonte(true, 20); cor(TXT); doc.text('RECIBO DE PAGAMENTO', W - M, y + 8, { align: 'right' })
  fonte(true, 10); cor(AZUL); doc.text(`Nº ${d.numero}`, W - M, y + 15, { align: 'right' })
  fonte(false, 8.5); cor(MUDO); doc.text(`Data: ${dataFmt}`, W - M, y + 21, { align: 'right' })
  y += 28
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 1, 'F')
  y += 10

  // ── Bloco principal do recibo ──
  doc.setFillColor(FAIXA); doc.roundedRect(M, y, CW, 36, 2, 2, 'F')
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 36, 2, 2, 'S')

  fonte(false, 8.5); cor(MUDO); doc.text('RECEBEMOS DE', M + 5, y + 8)
  fonte(true, 12); cor(TXT); doc.text(d.clienteNome, M + 5, y + 15)

  fonte(false, 8.5); cor(MUDO); doc.text('A IMPORTÂNCIA DE', M + 5, y + 23)
  fonte(true, 18); doc.setTextColor(AZUL); doc.text(brl(d.valor), M + 5, y + 32)

  fonte(false, 8.5); cor(MUDO); doc.text('FORMA DE PAGAMENTO', M + CW - 70, y + 23)
  fonte(true, 11); cor(TXT); doc.text(FORMA_LABEL[d.forma] ?? d.forma, M + CW - 70, y + 32)
  y += 44

  // ── Referente a ──
  fonte(true, 9); cor(AZUL); doc.text('REFERENTE A', M, y); y += 3
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 20, 1.5, 1.5, 'S')
  fonte(false, 8.5); cor(MUDO); doc.text('PEDIDO', M + 4, y + 7)
  fonte(true, 10); cor(TXT); doc.text(d.pedidoCodigo, M + 4, y + 13)

  if (d.containers.length > 0) {
    const lista = d.containers.map(c => `${c.numero}${c.tamanho ? ` (${c.tamanho})` : ''}`).join('  ·  ')
    fonte(false, 8.5); cor(MUDO); doc.text('CONTAINERS', M + CW / 3, y + 7)
    fonte(true, 9); cor(TXT)
    const ls = doc.splitTextToSize(lista, CW - CW / 3 - 8)
    doc.text(ls, M + CW / 3, y + 13)
  }

  if (d.obs) {
    fonte(false, 8); cor(MUDO); doc.text(`Obs: ${d.obs}`, M + 4, y + 18)
  }
  y += 28

  // ── Resumo financeiro ──
  fonte(true, 9); cor(AZUL); doc.text('RESUMO DO PEDIDO', M, y); y += 3
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 30, 1.5, 1.5, 'S')

  const col2 = M + CW / 2
  fonte(false, 8); cor(MUDO)
  doc.text('TOTAL DO PEDIDO', M + 4, y + 9)
  doc.text('PAGO ATÉ ESTE RECIBO', col2 + 4, y + 9)
  fonte(true, 12); cor(TXT)
  doc.text(brl(d.totalPedido), M + 4, y + 18)
  doc.text(brl(d.totalPagoApos), col2 + 4, y + 18)

  fonte(false, 8); cor(MUDO); doc.text('SALDO DEVEDOR', M + 4, y + 25)
  fonte(true, 12)
  doc.setTextColor(saldo > 0 ? '#dc2626' : '#16a34a')
  doc.text(brl(saldo), M + 4, y + 25 + 7)
  if (saldo === 0) {
    fonte(true, 10); doc.setTextColor('#16a34a')
    doc.text('✓ QUITADO', col2 + 4, y + 25 + 7)
  }
  y += 38

  // ── Assinaturas ──
  y += 10
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 0.9, 'F')
  y += 10
  doc.setDrawColor(TXT); doc.setLineWidth(0.3)
  doc.line(M, y, M + 80, y); doc.line(W - M - 80, y, W - M, y)
  fonte(false, 8); cor(MUDO)
  doc.text('MLA Containers', M, y + 4.5)
  doc.text(`Cliente: ${d.clienteNome}`, W - M - 80, y + 4.5)
  fonte(false, 7.5); doc.text(`Itajaí/SC, ${dataFmt}`, M, y + 8.5)

  return { blob: doc.output('blob'), nome: `Recibo-${d.numero}.pdf` }
}
