// Módulos do app — controle granular por usuário (admin configura em /usuarios)
// null = vê todos os módulos da sua role; string[] = apenas os listados
export const MODULOS: { key: string; label: string; descricao: string }[] = [
  { key: 'estoque',       label: 'Estoque',           descricao: 'Inventário, Financeiro, Importar, Exportar' },
  { key: 'equipamentos',  label: 'Equipamentos',      descricao: 'Painel, Checklist, Histórico, Indicadores' },
  { key: 'cadastros',     label: 'Cadastros',         descricao: 'Cadastro de empilhadeiras e operadores' },
  { key: 'tarefas',       label: 'Gestão de Tarefas', descricao: 'Tarefas, Agenda, QR Code' },
  { key: 'bi',            label: 'BI Depot',          descricao: 'Dashboard analítico e faturamento' },
  { key: 'monitoramento', label: 'Clima',              descricao: 'Barragens SC, Rio Itajaí, Barra do Itajaí' },
]

export const MODULOS_KEYS = MODULOS.map(m => m.key)
