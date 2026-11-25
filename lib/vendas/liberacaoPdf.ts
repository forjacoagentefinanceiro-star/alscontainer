// PDF de Autorização de Retirada (Liberação de containers ao terminal)
import type { jsPDF as JsPDF } from 'jspdf'

const TXT = '#111418', MUDO = '#5f6670', AZUL = '#1B4F8A', LINHA = '#d5d8dc', FAIXA = '#f3f4f6'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export type LiberacaoDados = {
  codigo: string            // PD-2026-0001
  propostaCodigo: string | null
  clienteNome: string
  telefone: string | null
  cidade: string | null
  containers: { id: string | null; numero: string; tamanho: string }[]
  total: number
  liberadoEm: string | null
  obsLiberacao: string | null
}

async function carregarLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch('/logo.png')).blob()
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

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function gerarLiberacaoPdf(d: LiberacaoDados): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import('jspdf')
  const doc: JsPDF = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, M = 15, CW = W - 2 * M
  const logo = await carregarLogo()

  const cor = (c: string) => doc.setTextColor(c)
  const fonte = (bold: boolean, size: number) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size) }

  const dataLib = d.liberadoEm
    ? new Date(d.liberadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  // ── Cabeçalho ──
  let y = 13
  if (logo) {
    const lh = 18, lw = (logo.w / logo.h) * lh
    doc.addImage(logo.data, 'PNG', M, y, lw, lh)
  } else {
    fonte(true, 16); cor(AZUL); doc.text('ALS LOGÍSTICA', M, y + 10)
  }
  fonte(true, 18); cor(TXT); doc.text('AUTORIZAÇÃO DE RETIRADA', W - M, y + 8, { align: 'right' })
  fonte(true, 10); cor(AZUL); doc.text(`Nº ${d.codigo}`, W - M, y + 15, { align: 'right' })
  fonte(false, 8.5); cor(MUDO); doc.text(`Emitida em ${dataLib}`, W - M, y + 21, { align: 'right' })
  y += 28
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 1, 'F')
  y += 8

  // ── Cliente ──
  fonte(true, 9); cor(AZUL); doc.text('DADOS DO CLIENTE', M, y); y += 3
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 22, 1.5, 1.5, 'S')
  fonte(false, 7.5); cor(MUDO)
  doc.text('NOME / RAZÃO SOCIAL', M + 4, y + 6)
  doc.text('TELEFONE', M + CW / 2 + 2, y + 6)
  fonte(true, 10); cor(TXT)
  doc.text(d.clienteNome || '—', M + 4, y + 12)
  doc.text(d.telefone || '—', M + CW / 2 + 2, y + 12)
  if (d.cidade) {
    fonte(false, 7.5); cor(MUDO); doc.text('CIDADE', M + 4, y + 17)
    fonte(true, 9); cor(TXT); doc.text(d.cidade, M + 4, y + 22)
  }
  y += 30

  // ── Containers ──
  fonte(true, 9); cor(AZUL); doc.text('CONTAINERS AUTORIZADOS PARA RETIRADA', M, y); y += 3
  const cabH = 7
  doc.setFillColor(FAIXA); doc.rect(M, y, CW, cabH, 'F')
  doc.setDrawColor(TXT); doc.setLineWidth(0.4); doc.line(M, y + cabH, M + CW, y + cabH)
  fonte(true, 8.5); cor(TXT)
  doc.text('Nº', M + 4, y + 4.8)
  doc.text('NÚMERO DO CONTAINER', M + 14, y + 4.8)
  doc.text('TIPO', M + CW - 30, y + 4.8, { align: 'center' })
  y += cabH

  d.containers.forEach((c, idx) => {
    const lh = 8
    if (y + lh > H - 40) { doc.addPage(); y = 20 }
    if (idx % 2 === 0) { doc.setFillColor(FAIXA); doc.rect(M, y, CW, lh, 'F') }
    fonte(false, 9); cor(TXT)
    doc.text(String(idx + 1), M + 4, y + 5.5)
    fonte(true, 10); doc.text(c.numero || '—', M + 14, y + 5.5)
    fonte(false, 9); doc.text(c.tamanho || '—', M + CW - 30, y + 5.5, { align: 'center' })
    doc.setDrawColor(LINHA); doc.setLineWidth(0.2); doc.line(M, y + lh, M + CW, y + lh)
    y += lh
  })
  y += 6

  // ── Pagamento ──
  fonte(true, 9); cor(AZUL); doc.text('SITUAÇÃO DO PAGAMENTO', M, y); y += 3
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 16, 1.5, 1.5, 'S')
  fonte(false, 7.5); cor(MUDO); doc.text('TOTAL DO PEDIDO', M + 4, y + 6)
  doc.text('STATUS', M + CW / 2 + 2, y + 6)
  fonte(true, 12); cor(TXT); doc.text(brl(d.total), M + 4, y + 13)
  doc.setTextColor('#16a34a'); doc.text('✓ QUITADO', M + CW / 2 + 2, y + 13)
  y += 22

  if (d.propostaCodigo) {
    fonte(false, 8); cor(MUDO); doc.text(`Proposta de referência: ${d.propostaCodigo}`, M, y); y += 5
  }

  // ── Declaração ──
  if (y + 30 > H - 40) { doc.addPage(); y = 20 }
  y += 4
  doc.setFillColor(FAIXA); doc.rect(M, y, CW, 20, 'F')
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 20, 1.5, 1.5, 'S')
  fonte(false, 9); cor(TXT)
  const declaracao = doc.splitTextToSize(
    'Este documento autoriza a retirada dos containers listados acima pelo cliente identificado neste documento. ' +
    'Local de retirada: Pátio ALS Logística — Itajaí/SC.',
    CW - 8
  )
  doc.text(declaracao, M + 4, y + 7)
  y += 26

  if (d.obsLiberacao) {
    fonte(false, 8); cor(MUDO); doc.text(`Obs: ${d.obsLiberacao}`, M, y); y += 6
  }

  // ── Assinaturas ──
  if (y + 24 > H - 10) { doc.addPage(); y = 20 }
  y += 10
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 0.9, 'F')
  y += 8
  doc.setDrawColor(TXT); doc.setLineWidth(0.3)
  doc.line(M, y, M + 80, y); doc.line(W - M - 80, y, W - M, y)
  fonte(false, 8); cor(MUDO)
  doc.text('ALS Logística — Autorizado por', M, y + 4.5)
  doc.text(`Cliente: ${d.clienteNome || '—'}`, W - M - 80, y + 4.5)
  fonte(false, 7.5); doc.text(dataLib, M, y + 8.5)

  const nomeArq = `Liberacao-${d.codigo}.pdf`
  return { blob: doc.output('blob'), nome: nomeArq }
}
