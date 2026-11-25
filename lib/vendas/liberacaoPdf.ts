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
