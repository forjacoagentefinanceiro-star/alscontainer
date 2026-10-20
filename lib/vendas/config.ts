// Configuração do CRM de vendas de containers usados (módulo "vendas")

export const PRODUTO = "Container 40' High Cube usado"

export const ETAPAS = [
  { key: 'novo',     label: 'Novo',            cor: '#64748b' },
  { key: 'conversa', label: 'Em conversa',     cor: '#1B4F8A' },
  { key: 'visita',   label: 'Visita agendada', cor: '#7c3aed' },
  { key: 'proposta', label: 'Proposta',        cor: '#d97706' },
  { key: 'sinal',    label: 'Sinal pago',      cor: '#0891b2' },
  { key: 'vendido',  label: 'Vendido',         cor: '#16a34a' },
  { key: 'perdido',  label: 'Perdido',         cor: '#dc2626' },
] as const
export type EtapaKey = (typeof ETAPAS)[number]['key']
export const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map(e => [e.key, e.label]))
export const ETAPA_COR: Record<string, string> = Object.fromEntries(ETAPAS.map(e => [e.key, e.cor]))
export const ETAPAS_ABERTAS = ETAPAS.filter(e => e.key !== 'vendido' && e.key !== 'perdido').map(e => e.key)

export const CANAIS = [
  { key: 'marketplace', label: 'Facebook Marketplace' },
  { key: 'whatsapp',    label: 'WhatsApp' },
  { key: 'instagram',   label: 'Instagram' },
  { key: 'tiktok',      label: 'TikTok Shop' },
  { key: 'olx',         label: 'OLX' },
  { key: 'indicacao',   label: 'Indicação' },
  { key: 'outro',       label: 'Outro' },
] as const
export const CANAL_LABEL: Record<string, string> = Object.fromEntries(CANAIS.map(c => [c.key, c.label]))

export const USOS = ['Obra / canteiro', 'Depósito', 'Loja / quiosque', 'Casa container', 'Sítio / fazenda', 'Outro']

export type Lead = {
  id: string; nome: string; telefone: string | null; cidade: string | null
  canal: string; campanha_id: string | null; uso: string | null; ano_pref: number | null
  preco: number | null; etapa: string; motivo_perda: string | null; responsavel: string | null
  obs: string | null; criado_em: string; atualizado_em: string
  primeira_resposta_em: string | null; fechado_em: string | null
  container_id: string | null
}
export type Campanha = {
  id: string; nome: string; canal: string; inicio: string | null; fim: string | null
  verba: number; link: string | null; utm: string | null; ativa: boolean
}
export type Tarefa = { id: string; lead_id: string; titulo: string; vence_em: string; concluida_em: string | null }
export type Atividade = { id: string; lead_id: string; tipo: string; texto: string; criado_em: string }
/** Container do estoque do ALS Container marcado "para venda" */
export type EstoqueItem = {
  id: string; numero: string; tamanho: string; ano_fabricacao: number | null
  preco_anuncio: number | null; status: string | null; obs: string | null
}

export const brl = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function numeroWhats(tel: string | null | undefined): string | null {
  const d = (tel ?? '').replace(/\D/g, '')
  if (d.length < 10) return null
  return d.startsWith('55') ? d : `55${d}`
}
export function formatTelefone(tel: string | null | undefined): string {
  const d = (tel ?? '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return tel ?? ''
}

export function primeiroNome(nome: string) {
  const p = nome.trim().split(/\s+/)[0] ?? ''
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : ''
}

export function dataHora(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}
export function dataCurta(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}
export const agoraMs = () => Date.now()

export function diasDesde(iso: string, agora = Date.now()) {
  return Math.floor((agora - new Date(iso).getTime()) / 86400000)
}

// ── Mensagens prontas (editáveis antes de enviar) ──────────────────────────
// [CIDADE] e o número vêm da tela; ajuste o texto aqui para mudar o padrão.
export const CIDADE_PATIO = 'Itajaí/SC'

export type ModeloMsg = { key: string; titulo: string; texto: (l: Lead, preco?: string) => string }
export const MODELOS: ModeloMsg[] = [
  {
    key: 'primeira', titulo: 'Primeira resposta',
    texto: l => `Olá${l.nome ? `, ${primeiroNome(l.nome)}` : ''}! Obrigado pelo interesse no container 40' High Cube. Ele está disponível e você pode ver pessoalmente no pátio em ${CIDADE_PATIO}. Vai usar para quê e em qual cidade? Assim já te passo o frete.`,
  },
  {
    key: 'preco', titulo: 'Preço',
    texto: (l, preco) => `${primeiroNome(l.nome) || 'Olá'}, o valor vai de R$ 10.300,00 a R$ 11.400,00, conforme o ano do container${preco ? ` (o ${l.ano_pref ?? 'desse ano'} está por ${preco})` : ''}. Posso te enviar fotos e vídeo do interior. Quer agendar uma visita?`,
  },
  {
    key: 'visita', titulo: 'Confirmar visita',
    texto: l => `Oi ${primeiroNome(l.nome)}, passando para confirmar sua visita ao pátio em ${CIDADE_PATIO}. Qualquer imprevisto me avise por aqui.`,
  },
  {
    key: 'followup', titulo: 'Follow-up (24 h sem resposta)',
    texto: l => `Oi ${primeiroNome(l.nome)}, conseguiu pensar no container? Ainda tenho a unidade e posso segurar para você por alguns dias.`,
  },
  {
    key: 'proposta', titulo: 'Enviar proposta',
    texto: (l, preco) => `${primeiroNome(l.nome)}, segue a proposta: container 40' High Cube${l.ano_pref ? ` ano ${l.ano_pref}` : ''}, ${preco ?? 'valor a combinar'}, retirada no pátio em ${CIDADE_PATIO}. Frete: posso cotar para ${l.cidade ?? 'a sua cidade'}. Fechamos?`,
  },
]

// Tarefa automática criada a cada mudança de etapa: [título, horas até vencer]
export const TAREFA_POR_ETAPA: Record<string, [string, number] | undefined> = {
  novo:     ['Responder o lead (primeira resposta)', 1],
  conversa: ['Follow-up: lead sem resposta', 24],
  visita:   ['Confirmar visita ao pátio', 24],
  proposta: ['Follow-up da proposta', 48],
  sinal:    ['Combinar retirada/entrega e emitir nota fiscal', 24],
}
