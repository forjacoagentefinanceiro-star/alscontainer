// Gera o PDF da proposta de venda da MLA Containers (jsPDF, roda no navegador).
// Identidade: fundo #0c0e12, laranja #ff9f1a, off-white #f3efe6.
import type { jsPDF as JsPDF } from 'jspdf'

export type PropItem = { descricao: string; detalhe?: string; qtd: number; unit: number }
export type PropDados = {
  numero: string
  emissao: string       // dd/mm/aaaa
  validade: string      // dd/mm/aaaa
  cliente: { nome: string; telefone: string; email: string; documento: string; cidade: string }
  itens: PropItem[]
  pagamento: string
  frete: string
  observacoes: string
  ilustrativas: boolean
}

export const EMPRESA = {
  whats: '(47) 98917-3801',
  endereco: 'Av. Gov. Adolfo Konder, 2600, São Vicente, Itajaí/SC',
  site: 'mlacontainers.com.br',
}

const BG = '#0c0e12', LARANJA = '#ff9f1a', OFF = '#f3efe6', CARD = '#161a21', MUDO = '#9a9a94'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function carregarLogo(): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch('/containers/mla-logo.png')).blob()
    const data: string = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob)
    })
    // reduz o logo (transparente) para não pesar no PDF; canvas mantém o canal alfa
    const im: HTMLImageElement = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = data
    })
    const esc = Math.min(1, 800 / im.naturalWidth)
    const cv = document.createElement('canvas')
    cv.width = Math.round(im.naturalWidth * esc); cv.height = Math.round(im.naturalHeight * esc)
    cv.getContext('2d')!.drawImage(im, 0, 0, cv.width, cv.height)
    return { data: cv.toDataURL('image/png'), w: cv.width, h: cv.height }
  } catch { return null }
}

export async function gerarPropostaPdf(d: PropDados): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import('jspdf')
  const doc: JsPDF = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, M = 14, CW = W - 2 * M
  const logo = await carregarLogo()

  const fundo = () => { doc.setFillColor(BG); doc.rect(0, 0, W, H, 'F') }
  const cor = (c: string) => doc.setTextColor(c)
  const fonte = (bold: boolean, size: number) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size) }
  const quebra = (t: string, w: number) => doc.splitTextToSize(t, w) as string[]

  function rodape() {
    doc.setDrawColor(LARANJA); doc.setLineWidth(0.4); doc.line(M, H - 20, W - M, H - 20)
    fonte(false, 8); cor(OFF)
    doc.text(`WhatsApp ${EMPRESA.whats}  ·  ${EMPRESA.site}`, M, H - 14)
    doc.text(EMPRESA.endereco, M, H - 9.5)
    fonte(true, 8); cor(LARANJA); doc.text('ITAJAÍ · SC', W - M, H - 14, { align: 'right' })
  }

  function novaPagina() { doc.addPage(); fundo(); rodape(); return 20 }

  // ── Página 1: cabeçalho ──
  fundo(); rodape()
  let y = 14
  if (logo) {
    const lh = 20, lw = (logo.w / logo.h) * lh
    doc.addImage(logo.data, 'PNG', M, y, lw, lh)
  } else { fonte(true, 22); cor(OFF); doc.text('MLA CONTAINERS', M, y + 12) }
  fonte(true, 9); cor(LARANJA); doc.text('ITAJAÍ · SC', W - M, y + 6, { align: 'right' })
  fonte(true, 22); cor(OFF); doc.text('PROPOSTA DE VENDA', W - M, y + 15, { align: 'right' })
  fonte(false, 9); cor(MUDO); doc.text(`Nº ${d.numero}  ·  Emitida em ${d.emissao}`, W - M, y + 21, { align: 'right' })
  y += 27
  doc.setFillColor(LARANJA); doc.rect(M, y, CW, 1, 'F')
  y += 8

  // ── Cliente ──
  fonte(true, 10); cor(LARANJA); doc.text('DADOS DO CLIENTE', M, y); y += 3
  const campos: [string, string][] = [
    ['Nome / Razão social', d.cliente.nome], ['CPF / CNPJ', d.cliente.documento],
    ['WhatsApp / Telefone', d.cliente.telefone], ['E-mail', d.cliente.email], ['Cidade', d.cliente.cidade],
  ]
  const colW = CW / 2 - 6
  const pares: [string, string][][] = []
  for (let i = 0; i < campos.length; i += 2) pares.push(campos.slice(i, i + 2))
  const alturas = pares.map(p => Math.max(...p.map(([, v]) => quebra(v || '—', colW - 8).length)) * 4.6 + 9)
  const boxH = alturas.reduce((a, b) => a + b, 0) + 3
  doc.setFillColor(CARD); doc.roundedRect(M, y, CW, boxH, 2, 2, 'F')
  let yy = y + 6
  pares.forEach((p, i) => {
    p.forEach(([rot, val], j) => {
      const x = M + 5 + j * (CW / 2)
      fonte(false, 7.5); cor(MUDO); doc.text(rot.toUpperCase(), x, yy)
      fonte(true, 10.5); cor(OFF); doc.text(quebra(val || '—', colW - 8), x, yy + 5)
    })
    yy += alturas[i]
  })
  y += boxH + 9

  // ── Itens ──
  fonte(true, 10); cor(LARANJA); doc.text('ITENS DA PROPOSTA', M, y); y += 3
  const cx = { desc: M + 3, qtd: M + CW - 62, unit: M + CW - 31, tot: M + CW - 3 }
  const cabecalho = () => {
    doc.setFillColor(LARANJA); doc.rect(M, y, CW, 7, 'F')
    fonte(true, 8.5); cor(BG)
    doc.text('DESCRIÇÃO', cx.desc, y + 4.8)
    doc.text('QTD', cx.qtd, y + 4.8, { align: 'right' })
    doc.text('UNITÁRIO', cx.unit, y + 4.8, { align: 'right' })
    doc.text('TOTAL', cx.tot, y + 4.8, { align: 'right' })
    y += 7
  }
  cabecalho()
  let total = 0
  d.itens.forEach((it, idx) => {
    const linhas = quebra(it.descricao, cx.qtd - cx.desc - 12)
    const det = it.detalhe ? quebra(it.detalhe, cx.qtd - cx.desc - 12) : []
    const h = linhas.length * 4.8 + det.length * 3.9 + 4.5
    if (y + h > H - 26) { y = novaPagina(); cabecalho() }
    doc.setFillColor(idx % 2 ? BG : CARD); doc.rect(M, y, CW, h, 'F')
    const sub = it.qtd * it.unit; total += sub
    fonte(true, 10); cor(OFF); doc.text(linhas, cx.desc, y + 5.4)
    if (det.length) { fonte(false, 8); cor(MUDO); doc.text(det, cx.desc, y + 5.4 + linhas.length * 4.8 - 0.6) }
    fonte(false, 10); cor(OFF)
    doc.text(String(it.qtd), cx.qtd, y + 5.4, { align: 'right' })
    doc.text(brl(it.unit), cx.unit, y + 5.4, { align: 'right' })
    fonte(true, 10); doc.text(brl(sub), cx.tot, y + 5.4, { align: 'right' })
    y += h
  })
  if (y + 18 > H - 26) y = novaPagina()
  y += 3
  doc.setFillColor(LARANJA); doc.roundedRect(M + CW - 82, y, 82, 11, 1.5, 1.5, 'F')
  fonte(true, 9); cor(BG); doc.text('TOTAL', M + CW - 78, y + 7)
  fonte(true, 14); doc.text(brl(total), M + CW - 4, y + 7.6, { align: 'right' })
  y += 19

  // ── Condições ──
  const blocos: [string, string][] = [
    ['VALIDADE DA PROPOSTA', `Válida até ${d.validade}.`],
    ['CONDIÇÕES DE PAGAMENTO', d.pagamento],
    ['FRETE / ENTREGA', d.frete],
  ]
  if (d.observacoes.trim()) blocos.push(['OBSERVAÇÕES', d.observacoes.trim()])
  if (d.ilustrativas) blocos.push(['IMAGENS', 'Imagens ilustrativas. O container entregue pode apresentar variações de aparência.'])
  for (const [t, v] of blocos) {
    const ls = quebra(v || '—', CW - 10)
    const h = ls.length * 4.8 + 12
    if (y + h > H - 26) y = novaPagina()
    doc.setFillColor(CARD); doc.roundedRect(M, y, CW, h, 2, 2, 'F')
    doc.setFillColor(LARANJA); doc.rect(M, y + 2, 1.2, h - 4, 'F')
    fonte(true, 8.5); cor(LARANJA); doc.text(t, M + 5, y + 5.5)
    fonte(false, 10); cor(OFF); doc.text(ls, M + 5, y + 11)
    y += h + 3.5
  }

  const nome = `Proposta-MLA-${d.numero}-${(d.cliente.nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`
  return { blob: doc.output('blob'), nome }
}
