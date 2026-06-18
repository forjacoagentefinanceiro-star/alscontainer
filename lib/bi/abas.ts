// Abas do BI — lista canônica usada para controlar o que cada usuário vê.
// As chaves batem com: 'visao-geral' | key das categorias | 'faturamento' | 'conferencia'.
export const BI_ABAS: { key: string; label: string }[] = [
  { key: 'visao-geral', label: 'Visão Geral' },
  { key: 'movimentacao', label: 'Movimentação' },
  { key: 'patio', label: 'Pátio' },
  { key: 'vistorias', label: 'Vistorias' },
  { key: 'reparos', label: 'Reparos' },
  { key: 'permanencia', label: 'Permanência' },
  { key: 'outros', label: 'Outros' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'conferencia', label: 'Conferência' },
]

export const BI_ABAS_KEYS = BI_ABAS.map((a) => a.key)
