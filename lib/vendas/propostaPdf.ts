// Gera o PDF da proposta de venda da MLA Containers (jsPDF, roda no navegador).
// Layout para impressão: fundo branco, texto escuro, laranja só em filetes e detalhes (economiza toner).
import type { jsPDF as JsPDF } from 'jspdf'

export type PropItem = {
  descricao: string; detalhe?: string; qtd: number; unit: number
  numero?: string | null; ano?: number | null
}
export type PropDados = {
  numero: string        // código da proposta (PV-2026-0001)
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

const TXT = '#111418', MUDO = '#5f6670', LARANJA = '#e8890c', LINHA = '#d5d8dc', FAIXA = '#f3f4f6'
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
  const W = 210, H = 297, M = 15, CW = W - 2 * M
  const logo = await carregarLogo()

  const cor = (c: string) => doc.setTextColor(c)
  const fonte = (bold: boolean, size: number) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size) }
  const quebra = (t: string, w: number) => doc.splitTextToSize(t, w) as string[]

  function rodape(pag: number) {
    doc.setDrawColor(LARANJA); doc.setLineWidth(0.5); doc.line(M, H - 20, W - M, H - 20)
    fonte(false, 8); cor(MUDO)
    doc.text(`MLA Containers  ·  WhatsApp ${EMPRESA.whats}  ·  ${EMPRESA.site}`, M, H - 14.5)
    doc.text(EMPRESA.endereco, M, H - 10)
    fonte(true, 8); cor(TXT)
    doc.text(`Proposta ${d.numero}  ·  pág. ${pag}`, W - M, H - 14.5, { align: 'right' })
    fonte(true, 8); cor(LARANJA); doc.text('ITAJAÍ · SC', W - M, H - 10, { align: 'right' })
  }
  let pag = 1
  function novaPagina() { rodape(pag); doc.addPage(); pag++; return 18 }

  // ── Cabeçalho ──
  let y = 13
  if (logo) {
    const lh = 21, lw = (logo.w / logo.h) * lh
    doc.addImage(logo.data, 'PNG', M, y, lw, lh)
  } else { fonte(true, 22); cor(TXT); doc.text('MLA CONTAINERS', M, y + 12) }
  fonte(true, 20); cor(TXT); doc.text('PROPOSTA DE VENDA', W - M, y + 8, { align: 'right' })
  fonte(true, 11); cor(LARANJA); doc.text(`Nº ${d.numero}`, W - M, y + 14.5, { align: 'right' })
  fonte(false, 9); cor(MUDO)
  doc.text(`Emitida em ${d.emissao}  ·  Válida até ${d.validade}`, W - M, y + 20, { align: 'right' })
  y += 26
  doc.setFillColor(LARANJA); doc.rect(M, y, CW, 0.9, 'F')
  y += 8

  // ── Cliente ──
  fonte(true, 9.5); cor(LARANJA); doc.text('DADOS DO CLIENTE', M, y); y += 2.5
  const campos: [string, string][] = [
    ['Nome / Razão social', d.cliente.nome], ['CPF / CNPJ', d.cliente.documento],
    ['WhatsApp / Telefone', d.cliente.telefone], ['E-mail', d.cliente.email], ['Cidade', d.cliente.cidade],
  ]
  const colW = CW / 2 - 6
  const pares: [string, string][][] = []
  for (let i = 0; i < campos.length; i += 2) pares.push(campos.slice(i, i + 2))
  const alturas = pares.map(p => Math.max(...p.map(([, v]) => quebra(v || '—', colW - 4).length)) * 4.6 + 9)
  const boxH = alturas.reduce((a, b) => a + b, 0) + 2
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, boxH, 1.5, 1.5, 'S')
  let yy = y + 6
  pares.forEach((p, i) => {
    p.forEach(([rot, val], j) => {
      const x = M + 4 + j * (CW / 2)
      fonte(false, 7.5); cor(MUDO); doc.text(rot.toUpperCase(), x, yy)
      fonte(true, 10.5); cor(TXT); doc.text(quebra(val || '—', colW - 4), x, yy + 5)
    })
    yy += alturas[i]
  })
  y += boxH + 9

  // ── Itens ──
  fonte(true, 9.5); cor(LARANJA); doc.text('ITENS DA PROPOSTA', M, y); y += 2.5
  const cx = { desc: M + 2.5, ano: M + CW - 78, qtd: M + CW - 62, unit: M + CW - 31, tot: M + CW - 2.5 }
  const descW = cx.ano - cx.desc - 12
  const cabecalho = () => {
    doc.setFillColor(FAIXA); doc.rect(M, y, CW, 7, 'F')
    doc.setDrawColor(TXT); doc.setLineWidth(0.4); doc.line(M, y + 7, M + CW, y + 7)
    fonte(true, 8.5); cor(TXT)
    doc.text('DESCRIÇÃO', cx.desc, y + 4.8)
    doc.text('ANO', cx.ano, y + 4.8, { align: 'center' })
    doc.text('QTD', cx.qtd, y + 4.8, { align: 'right' })
    doc.text('UNITÁRIO', cx.unit, y + 4.8, { align: 'right' })
    doc.text('TOTAL', cx.tot, y + 4.8, { align: 'right' })
    y += 7
  }
  cabecalho()
  let total = 0
  d.itens.forEach(it => {
    const linhas = quebra(it.descricao, descW)
    const det = it.detalhe ? quebra(it.detalhe, descW) : []
    const h = linhas.length * 4.8 + det.length * 3.9 + 4.5
    if (y + h > H - 26) { y = novaPagina(); cabecalho() }
    const sub = it.qtd * it.unit; total += sub
    fonte(true, 10); cor(TXT); doc.text(linhas, cx.desc, y + 5.4)
    if (det.length) { fonte(false, 8); cor(MUDO); doc.text(det, cx.desc, y + 5.4 + linhas.length * 4.8 - 0.6) }
    fonte(true, 10); cor(TXT)
    doc.text(it.ano ? String(it.ano) : '—', cx.ano, y + 5.4, { align: 'center' })
    fonte(false, 10)
    doc.text(String(it.qtd), cx.qtd, y + 5.4, { align: 'right' })
    doc.text(brl(it.unit), cx.unit, y + 5.4, { align: 'right' })
    fonte(true, 10); doc.text(brl(sub), cx.tot, y + 5.4, { align: 'right' })
    doc.setDrawColor(LINHA); doc.setLineWidth(0.2); doc.line(M, y + h, M + CW, y + h)
    y += h
  })
  if (y + 18 > H - 26) y = novaPagina()
  y += 4
  doc.setDrawColor(TXT); doc.setLineWidth(0.4); doc.line(M + CW - 84, y, M + CW, y)
  fonte(true, 10); cor(TXT); doc.text('TOTAL DA PROPOSTA', M + CW - 84, y + 7.5)
  fonte(true, 15); cor(TXT); doc.text(brl(total), M + CW, y + 7.8, { align: 'right' })
  doc.setFillColor(LARANJA); doc.rect(M + CW - 84, y + 10.5, 84, 0.9, 'F')
  y += 20

  // ── Condições ──
  const blocos: [string, string][] = [
    ['VALIDADE DA PROPOSTA', `Válida até ${d.validade}.`],
    ['CONDIÇÕES DE PAGAMENTO', d.pagamento],
    ['FRETE / ENTREGA', d.frete],
  ]
  if (d.observacoes.trim()) blocos.push(['OBSERVAÇÕES', d.observacoes.trim()])
  if (d.ilustrativas) blocos.push(['IMAGENS', 'Imagens ilustrativas. O container entregue pode apresentar variações de aparência.'])
  for (const [t, v] of blocos) {
    const ls = quebra(v || '—', CW - 8)
    const h = ls.length * 4.8 + 11
    if (y + h > H - 26) y = novaPagina()
    doc.setFillColor(LARANJA); doc.rect(M, y, 1, h - 2, 'F')
    fonte(true, 8.5); cor(LARANJA); doc.text(t, M + 4, y + 4)
    fonte(false, 10); cor(TXT); doc.text(ls, M + 4, y + 9.5)
    y += h + 2
  }

  // ── Assinaturas ──
  if (y + 24 > H - 24) y = novaPagina()
  y += 10
  doc.setDrawColor(TXT); doc.setLineWidth(0.3)
  doc.line(M, y, M + 78, y); doc.line(W - M - 78, y, W - M, y)
  fonte(false, 8.5); cor(MUDO)
  doc.text('MLA Containers', M, y + 4.5)
  doc.text(`De acordo: ${d.cliente.nome || 'cliente'}`, W - M - 78, y + 4.5)

  rodape(pag)
  const nome = `Proposta-${d.numero}-${(d.cliente.nome || 'cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`
  return { blob: doc.output('blob'), nome }
}

/** Baixa o PDF no navegador */
export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
