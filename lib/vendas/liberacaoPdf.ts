// PDF de Autorização de Retirada (Liberação de containers ao terminal)
import type { jsPDF as JsPDF } from 'jspdf'

const TXT = '#111418', MUDO = '#5f6670', AZUL = '#1B4F8A', LINHA = '#d5d8dc', FAIXA = '#f3f4f6'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export type MotoristaLiberacao = {
  container_numero: string
  motorista_nome: string
  motorista_doc: string
  veiculo_placa: string
  veiculo_modelo: string
}

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
  motoristas?: MotoristaLiberacao[] | null
  // legado (pedidos liberados antes da feature de múltiplos)
  motoristaNome?: string | null
  motoristaDoc?: string | null
  veiculoPlaca?: string | null
  veiculoModelo?: string | null
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

  // ── Motorista(s) / Veículo(s) ──
  const mots: MotoristaLiberacao[] = d.motoristas?.length
    ? d.motoristas
    : d.motoristaNome
      ? [{ container_numero: '', motorista_nome: d.motoristaNome, motorista_doc: d.motoristaDoc ?? '', veiculo_placa: d.veiculoPlaca ?? '', veiculo_modelo: d.veiculoModelo ?? '' }]
      : []

  if (mots.length > 0) {
    fonte(true, 9); cor(AZUL); doc.text('MOTORISTAS E VEÍCULOS', M, y); y += 3
    const cabH2 = 7
    doc.setFillColor(FAIXA); doc.rect(M, y, CW, cabH2, 'F')
    doc.setDrawColor(TXT); doc.setLineWidth(0.4); doc.line(M, y + cabH2, M + CW, y + cabH2)
    fonte(true, 8); cor(TXT)
    const c1 = M + 4, c2 = M + CW * 0.28, c3 = M + CW * 0.52, c4 = M + CW * 0.70
    doc.text('CONTAINER', c1, y + 4.8)
    doc.text('MOTORISTA', c2, y + 4.8)
    doc.text('PLACA', c3, y + 4.8)
    doc.text('MODELO / TIPO', c4, y + 4.8)
    y += cabH2

    mots.forEach((m, idx) => {
      const rh = 8
      if (y + rh > H - 40) { doc.addPage(); y = 20 }
      if (idx % 2 === 0) { doc.setFillColor(FAIXA); doc.rect(M, y, CW, rh, 'F') }
      fonte(false, 8.5); cor(TXT)
      doc.text(m.container_numero || '—', c1, y + 5.5)
      fonte(true, 8.5); doc.text(m.motorista_nome || '—', c2, y + 5.5)
      fonte(false, 8.5)
      doc.text(m.veiculo_placa || '—', c3, y + 5.5)
      doc.text(m.veiculo_modelo || '—', c4, y + 5.5)
      if (m.motorista_doc) { fonte(false, 7); cor(MUDO); doc.text(`Doc: ${m.motorista_doc}`, c2, y + 7.5) }
      doc.setDrawColor(LINHA); doc.setLineWidth(0.2); doc.line(M, y + rh, M + CW, y + rh)
      y += rh
    })
    y += 6
  }

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

// ── Ordem de Retirada (1 folha por container, motorista apresenta no gate) ──

export type OrdemRetiradaDados = {
  pedidoCodigo: string
  clienteNome: string
  cidade: string | null
  container: { numero: string; tamanho: string }
  motorista: { nome: string; doc: string; placa: string; modelo: string }
  liberadoEm: string   // ISO timestamp
}

async function carregarLogoMLA(): Promise<{ data: string; w: number; h: number } | null> {
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

export async function gerarOrdemRetiradaPdf(d: OrdemRetiradaDados): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import('jspdf')
  const doc: JsPDF = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, M = 15, CW = W - 2 * M

  const cor = (c: string) => doc.setTextColor(c)
  const fonte = (bold: boolean, size: number) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size) }

  const dataLib = new Date(d.liberadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const logo = await carregarLogoMLA()

  // ── Cabeçalho ──
  let y = 13
  if (logo) {
    const lh = 18, lw = (logo.w / logo.h) * lh
    doc.addImage(logo.data, 'PNG', M, y, lw, lh)
  } else {
    fonte(true, 15); cor(AZUL); doc.text('MLA CONTAINERS', M, y + 10)
  }
  fonte(true, 20); cor(TXT); doc.text('ORDEM DE RETIRADA', W - M, y + 8, { align: 'right' })
  fonte(false, 8.5); cor(MUDO); doc.text(`Ref: ${d.pedidoCodigo}  ·  ${dataLib}`, W - M, y + 15, { align: 'right' })
  y += 28
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 1.2, 'F')
  y += 10

  // ── Container (destaque) ──
  doc.setFillColor(AZUL); doc.roundedRect(M, y, CW, 28, 2, 2, 'F')
  fonte(false, 9); doc.setTextColor('#ffffff'); doc.text('CONTAINER AUTORIZADO PARA RETIRADA', M + CW / 2, y + 7, { align: 'center' })
  fonte(true, 32); doc.setTextColor('#ffffff'); doc.text(d.container.numero, M + CW / 2, y + 20, { align: 'center' })
  if (d.container.tamanho) {
    fonte(false, 10); doc.setTextColor('#a8c8f0'); doc.text(d.container.tamanho, M + CW / 2, y + 26, { align: 'center' })
  }
  y += 36

  // ── Cliente ──
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 18, 1.5, 1.5, 'S')
  fonte(false, 8); cor(MUDO); doc.text('CLIENTE / COMPRADOR', M + 4, y + 7)
  fonte(true, 11); cor(TXT); doc.text(d.clienteNome, M + 4, y + 14)
  if (d.cidade) { fonte(false, 8.5); cor(MUDO); doc.text(d.cidade, W - M - 4, y + 14, { align: 'right' }) }
  y += 25

  // ── Motorista ──
  fonte(true, 9); cor(AZUL); doc.text('DADOS DO MOTORISTA E VEÍCULO', M, y); y += 3
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 36, 1.5, 1.5, 'S')

  const col2 = M + CW / 2
  fonte(false, 8); cor(MUDO)
  doc.text('NOME DO MOTORISTA', M + 4, y + 8)
  doc.text('CPF / RG', col2 + 4, y + 8)
  fonte(true, 11); cor(TXT)
  doc.text(d.motorista.nome || '—', M + 4, y + 16)
  doc.text(d.motorista.doc || '—', col2 + 4, y + 16)

  fonte(false, 8); cor(MUDO)
  doc.text('PLACA DO VEÍCULO', M + 4, y + 24)
  doc.text('MODELO / TIPO', col2 + 4, y + 24)
  fonte(true, 11); cor(TXT)
  doc.text(d.motorista.placa || '—', M + 4, y + 32)
  doc.text(d.motorista.modelo || '—', col2 + 4, y + 32)
  y += 43

  // ── Declaração ──
  doc.setFillColor(FAIXA); doc.roundedRect(M, y, CW, 18, 1.5, 1.5, 'F')
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 18, 1.5, 1.5, 'S')
  fonte(false, 8.5); cor(TXT)
  const decl = doc.splitTextToSize(
    'Este documento autoriza o motorista identificado acima a retirar o container especificado. Deve ser apresentado no gate da ALS Logística juntamente com documento de identidade.',
    CW - 10
  )
  doc.text(decl, M + 5, y + 7)
  y += 25

  // ── Assinaturas ──
  y += 10
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 0.9, 'F')
  y += 10
  doc.setDrawColor(TXT); doc.setLineWidth(0.3)
  const assSep = CW / 3
  doc.line(M, y, M + assSep - 5, y)
  doc.line(M + assSep + 5, y, M + 2 * assSep - 5, y)
  doc.line(M + 2 * assSep + 5, y, W - M, y)
  fonte(false, 8); cor(MUDO)
  doc.text('MLA Containers — Emissor', M, y + 4.5)
  doc.text('Motorista — Ciente', M + assSep + 5, y + 4.5)
  doc.text('Gate ALS — Conferido', M + 2 * assSep + 5, y + 4.5)
  fonte(false, 7.5); doc.text(dataLib, M, y + 8.5)

  return { blob: doc.output('blob'), nome: `OrdemRetirada-${d.pedidoCodigo}-${d.container.numero}.pdf` }
}

// ── Fechamento Interno (uso exclusivo admin — financeiro sigiloso) ──

export type FechamentoItem = {
  numero: string
  tamanho: string
  precoVenda: number
  custoAquisicao: number
  despesas: number
}

export type FechamentoDados = {
  pedidoCodigo: string
  propostaCodigo: string | null
  clienteNome: string
  cidade: string | null
  criadoEm: string
  liberadoEm: string | null
  items: FechamentoItem[]
  totalVenda: number
  descontoAplicado: number
  fretePago: number
  outrosCustos: number
  impostoPct: number
  comissaoPct: number
  pagamentos: { forma: string; valor: number; data: string }[]
}

const FORMA_LABEL_FEC: Record<string, string> = {
  pix: 'Pix', transferencia: 'Transferência', dinheiro: 'Dinheiro',
  cartao: 'Cartão', cheque: 'Cheque', outro: 'Outro',
}

export async function gerarFechamentoPdf(d: FechamentoDados): Promise<{ blob: Blob; nome: string }> {
  const { jsPDF } = await import('jspdf')
  const doc: JsPDF = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const W = 210, H = 297, M = 15, CW = W - 2 * M

  const cor = (c: string) => doc.setTextColor(c)
  const fonte = (bold: boolean, size: number) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size) }

  const dataCriacao = new Date(d.criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const dataLib = d.liberadoEm
    ? new Date(d.liberadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '—'

  // totais calculados
  const totalCusto = d.items.reduce((s, i) => s + i.custoAquisicao, 0)
  const totalDespesas = d.items.reduce((s, i) => s + i.despesas, 0)
  const totalVendaLiquido = d.totalVenda - d.descontoAplicado
  const lucroBruto = totalVendaLiquido - totalCusto - totalDespesas
  const margemBruta = totalVendaLiquido > 0 ? (lucroBruto / totalVendaLiquido) * 100 : 0
  const valorImposto = d.impostoPct > 0 ? (totalVendaLiquido * d.impostoPct) / 100 : 0
  const valorComissao = d.comissaoPct > 0 ? (totalVendaLiquido * d.comissaoPct) / 100 : 0
  const lucroLiquido = lucroBruto - d.fretePago - d.outrosCustos - valorImposto - valorComissao
  const margemLiquida = totalVendaLiquido > 0 ? (lucroLiquido / totalVendaLiquido) * 100 : 0

  // ── Cabeçalho ──
  let y = 13
  const logo = await carregarLogoMLA()
  if (logo) {
    const lh = 18, lw = (logo.w / logo.h) * lh
    doc.addImage(logo.data, 'PNG', M, y, lw, lh)
  } else {
    fonte(true, 15); cor(AZUL); doc.text('MLA CONTAINERS', M, y + 10)
  }
  fonte(true, 18); cor(TXT); doc.text('FECHAMENTO INTERNO', W - M, y + 8, { align: 'right' })
  // badge CONFIDENCIAL
  doc.setFillColor('#fef2f2'); doc.setDrawColor('#fca5a5'); doc.setLineWidth(0.3)
  const badgeW = 36, badgeH = 7, badgeX = W - M - badgeW
  doc.roundedRect(badgeX, y + 11, badgeW, badgeH, 1.5, 1.5, 'FD')
  fonte(true, 7); doc.setTextColor('#dc2626'); doc.text('CONFIDENCIAL', W - M - badgeW / 2, y + 16.2, { align: 'center' })

  y += 28
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 1.2, 'F')
  y += 8

  // ── Info pedido ──
  doc.setFillColor(FAIXA); doc.roundedRect(M, y, CW, 20, 1.5, 1.5, 'F')
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, 20, 1.5, 1.5, 'S')
  const c1 = M + 4, c2 = M + CW * 0.28, c3 = M + CW * 0.56, c4 = M + CW * 0.78
  fonte(false, 7); cor(MUDO)
  doc.text('PEDIDO', c1, y + 6); doc.text('PROPOSTA', c2, y + 6)
  doc.text('CRIADO EM', c3, y + 6); doc.text('LIBERADO EM', c4, y + 6)
  fonte(true, 9); cor(TXT)
  doc.text(d.pedidoCodigo, c1, y + 14)
  doc.text(d.propostaCodigo ?? '—', c2, y + 14)
  doc.text(dataCriacao, c3, y + 14)
  doc.text(dataLib, c4, y + 14)
  y += 26

  fonte(false, 7); cor(MUDO); doc.text('CLIENTE', c1, y); doc.text('CIDADE', c3, y)
  fonte(true, 10); cor(TXT); doc.text(d.clienteNome, c1, y + 7); doc.text(d.cidade ?? '—', c3, y + 7)
  y += 16

  // ── Tabela de containers ──
  if (d.items.length > 0) {
    fonte(true, 9); cor(AZUL); doc.text('CONTAINERS E MARGENS', M, y); y += 3
    const cabH = 7
    doc.setFillColor('#1B4F8A'); doc.rect(M, y, CW, cabH, 'F')
    fonte(true, 7.5); doc.setTextColor('#ffffff')
    const tc1 = M + 4, tc2 = M + CW * 0.32, tc3 = M + CW * 0.49, tc4 = M + CW * 0.63, tc5 = M + CW * 0.77, tc6 = M + CW - 2
    doc.text('CONTAINER', tc1, y + 4.8)
    doc.text('VENDA', tc2, y + 4.8)
    doc.text('CUSTO', tc3, y + 4.8)
    doc.text('DESPESAS', tc4, y + 4.8)
    doc.text('LUCRO BRUTO', tc5, y + 4.8)
    doc.text('MARGEM', tc6, y + 4.8, { align: 'right' })
    y += cabH

    d.items.forEach((item, idx) => {
      const rh = 9
      if (y + rh > H - 60) { doc.addPage(); y = 20 }
      if (idx % 2 === 0) { doc.setFillColor(FAIXA); doc.rect(M, y, CW, rh, 'F') }
      const lBruto = item.precoVenda - item.custoAquisicao - item.despesas
      const lMarg = item.precoVenda > 0 ? (lBruto / item.precoVenda) * 100 : 0
      fonte(false, 8.5); cor(TXT)
      fonte(true, 8.5); doc.text(item.numero, tc1, y + 6)
      fonte(false, 8.5)
      if (item.tamanho) { cor(MUDO); doc.text(item.tamanho, tc1, y + 8.5); fonte(false, 7) }
      cor(TXT)
      doc.text(brl(item.precoVenda), tc2, y + 6)
      cor('#dc2626'); doc.text(brl(item.custoAquisicao), tc3, y + 6)
      cor(MUDO); doc.text(brl(item.despesas), tc4, y + 6)
      cor(lBruto >= 0 ? '#16a34a' : '#dc2626'); fonte(true, 8.5); doc.text(brl(lBruto), tc5, y + 6)
      doc.text(`${lMarg.toFixed(1)}%`, tc6, y + 6, { align: 'right' })
      doc.setDrawColor(LINHA); doc.setLineWidth(0.2); doc.line(M, y + rh, M + CW, y + rh)
      y += rh
    })

    // linha de totais
    const totH = 9
    doc.setFillColor(FAIXA); doc.rect(M, y, CW, totH, 'F')
    doc.setDrawColor(TXT); doc.setLineWidth(0.5); doc.line(M, y, M + CW, y)
    fonte(true, 8.5); cor(AZUL)
    doc.text('TOTAL', tc1, y + 6)
    cor(TXT); doc.text(brl(d.totalVenda), tc2, y + 6)
    cor('#dc2626'); doc.text(brl(totalCusto), tc3, y + 6)
    cor(MUDO); doc.text(brl(totalDespesas), tc4, y + 6)
    cor(lucroBruto >= 0 ? '#16a34a' : '#dc2626'); fonte(true, 8.5)
    doc.text(brl(lucroBruto), tc5, y + 6)
    doc.text(`${margemBruta.toFixed(1)}%`, tc6, y + 6, { align: 'right' })
    y += totH + 8
  }

  // ── Resumo financeiro ──
  // Caixa desenhada DEPOIS do conteúdo para altura dinâmica (evita overflow)
  if (y + 60 > H - 20) { doc.addPage(); y = 20 }
  fonte(true, 9); cor(AZUL); doc.text('RESUMO FINANCEIRO', M, y); y += 4
  const rl = M + 4, rr = M + CW - 4
  const yBoxStart = y     // topo da caixa (salvo antes de qualquer conteúdo)
  y += 5                  // padding interno superior

  // lin: label à esq, valor à dir, linha separadora se destaque
  const lin = (label: string, valor: number, destaque?: boolean, negativo?: boolean) => {
    fonte(false, destaque ? 10 : 8.5)
    cor(destaque ? AZUL : MUDO)
    doc.text(label, rl, y + 7)
    cor(negativo ? '#dc2626' : (destaque ? '#16a34a' : TXT))
    if (destaque) fonte(true, 10)
    doc.text(negativo ? `(${brl(Math.abs(valor))})` : brl(valor), rr, y + 7, { align: 'right' })
    if (destaque) {
      doc.setLineWidth(0.3); doc.setDrawColor(LINHA)
      doc.line(rl, y + 11, rr, y + 11)
    }
    y += destaque ? 13 : 9
  }

  lin('Total de venda (bruto)', d.totalVenda)
  if (d.descontoAplicado > 0) lin('Desconto aplicado', d.descontoAplicado, false, true)
  lin('(-) Custo de aquisição', totalCusto, false, true)
  lin('(-) Despesas', totalDespesas, false, true)
  lin('= Lucro bruto', lucroBruto, true, lucroBruto < 0)

  const temExtras = d.fretePago > 0 || d.outrosCustos > 0 || valorImposto > 0 || valorComissao > 0
  if (temExtras) {
    if (d.fretePago > 0) lin('(-) Frete pago', d.fretePago, false, true)
    if (d.outrosCustos > 0) lin('(-) Outros custos', d.outrosCustos, false, true)
    if (valorImposto > 0) lin(`(-) Impostos (${d.impostoPct}%)`, valorImposto, false, true)
    if (valorComissao > 0) lin(`(-) Comissão (${d.comissaoPct}%)`, valorComissao, false, true)
    lin('= Lucro líquido', lucroLiquido, true, lucroLiquido < 0)
    fonte(true, 9); cor('#16a34a')
    doc.text(`Margem líquida: ${margemLiquida.toFixed(1)}%`, rr, y + 5, { align: 'right' })
    y += 10
  } else {
    fonte(true, 9); cor('#16a34a')
    doc.text(`Margem bruta: ${margemBruta.toFixed(1)}%`, rr, y + 5, { align: 'right' })
    y += 10
  }

  y += 5  // padding interno inferior
  // Desenha a borda DEPOIS do conteúdo — height = real
  doc.setDrawColor(LINHA); doc.setLineWidth(0.3)
  doc.roundedRect(M, yBoxStart, CW, y - yBoxStart, 1.5, 1.5, 'S')
  y += 6  // espaço entre seções

  // ── Pagamentos ──
  if (d.pagamentos.length > 0) {
    if (y + 20 > H - 20) { doc.addPage(); y = 20 }
    fonte(true, 9); cor(AZUL); doc.text('PAGAMENTOS RECEBIDOS', M, y); y += 3
    doc.setDrawColor(LINHA); doc.setLineWidth(0.3)
    doc.roundedRect(M, y, CW, d.pagamentos.length * 9 + 6, 1.5, 1.5, 'S')
    y += 2
    d.pagamentos.forEach((pg, idx) => {
      if (idx % 2 === 0) { doc.setFillColor(FAIXA); doc.rect(M, y, CW, 9, 'F') }
      const dataFmt = new Date(pg.data + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      fonte(false, 8.5); cor(TXT)
      doc.text(FORMA_LABEL_FEC[pg.forma] ?? pg.forma, M + 4, y + 6)
      fonte(false, 8); cor(MUDO); doc.text(dataFmt, M + CW / 3, y + 6)
      fonte(true, 9); cor('#16a34a'); doc.text(brl(pg.valor), M + CW - 4, y + 6, { align: 'right' })
      y += 9
    })
    y += 6
  }

  // ── Rodapé ──
  if (y + 15 > H - 10) { doc.addPage(); y = 20 }
  y = Math.max(y, H - 25)
  doc.setFillColor(AZUL); doc.rect(M, y, CW, 0.9, 'F')
  y += 6
  fonte(false, 7.5); cor(MUDO)
  doc.text('Documento interno. Uso exclusivo da administração MLA Containers.', M, y)
  doc.text(new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), W - M, y, { align: 'right' })

  return { blob: doc.output('blob'), nome: `Fechamento-${d.pedidoCodigo}.pdf` }
}
