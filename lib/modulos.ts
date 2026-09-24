// Módulos do app — controle granular por usuário (admin configura em /usuarios)
// null = vê todos os módulos padrão da sua role; string[] = apenas os listados
// optIn = módulo que só aparece se for liberado explicitamente (null NÃO inclui)
export const MODULOS: { key: string; label: string; descricao: string; optIn?: boolean }[] = [
  { key: 'estoque',       label: 'Estoque',           descricao: 'Inventário, Financeiro, Importar, Exportar' },
  { key: 'equipamentos',  label: 'Equipamentos',      descricao: 'Painel, Checklist, Histórico, Indicadores' },
  { key: 'cadastros',     label: 'Cadastros',         descricao: 'Cadastro de empilhadeiras e operadores' },
  { key: 'tarefas',       label: 'Gestão de Tarefas', descricao: 'Tarefas, Agenda, QR Code' },
  { key: 'bi',            label: 'BI Depot',          descricao: 'Dashboard analítico e faturamento' },
  { key: 'monitoramento', label: 'Clima',              descricao: 'Barragens SC, Rio Itajaí, Barra do Itajaí' },
  { key: 'patio',         label: 'Mapa do Pátio',     descricao: 'Posições das ruas e oficina por armador (liberar por usuário)', optIn: true },
]

export const MODULOS_KEYS = MODULOS.map(m => m.key)
// o que "null" significa: todos os módulos que não são optIn
export const MODULOS_PADRAO_KEYS = MODULOS.filter(m => !m.optIn).map(m => m.key)
const OPT_IN = new Set(MODULOS.filter(m => m.optIn).map(m => m.key))

export function temModulo(role: string | undefined, modulos: string[] | null | undefined, key: string) {
  if (role === 'admin') return true
  if (OPT_IN.has(key)) return !!modulos?.includes(key)
  return !modulos || modulos.includes(key)
}
