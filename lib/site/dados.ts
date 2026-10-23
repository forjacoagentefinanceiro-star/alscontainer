// Dados públicos do site da MLA Containers (nada de nome do sistema interno aqui).
export const MARCA = 'MLA Containers'
export const WHATS = process.env.NEXT_PUBLIC_WHATSAPP_VENDAS || '5547989173801'
export const WHATS_EXIBIDO = '(47) 98917-3801'
export const ENDERECO_LINHA1 = 'Av. Gov. Adolfo Konder, 2600'
export const ENDERECO_LINHA2 = 'São Vicente · Itajaí/SC · CEP 88308-000'
export const ENDERECO_COMPLETO = `${ENDERECO_LINHA1}, ${ENDERECO_LINHA2}`
export const MAPA_EMBED = 'https://www.google.com/maps?q=Av.+Gov.+Adolfo+Konder,+2600,+Itaja%C3%AD,+SC&output=embed'
export const MAPA_LINK = 'https://www.google.com/maps/search/?api=1&query=Av.+Gov.+Adolfo+Konder,+2600,+Itaja%C3%AD,+SC'

export const BG = '#101217'
export const PAINEL = '#1a1d25'
export const ACENTO = '#ff9f1a'

export const MENU: [string, string][] = [
  ['/', 'Início'],
  ['/venda', 'Containers à venda'],
  ['/locacao', 'Locação'],
  ['/como-funciona', 'Como funciona'],
  ['/sobre', 'Sobre'],
  ['/contato', 'Contato'],
]

export const USOS: [string, string, string][] = [
  ['🏗️', 'Obra e canteiro', 'Depósito e escritório de obra, seguros e rápidos de instalar.'],
  ['🏪', 'Loja e quiosque', 'Abra o seu ponto de venda por muito menos que uma construção.'],
  ['📦', 'Depósito', 'Guarde estoque, ferramentas e equipamentos com segurança.'],
  ['🏠', 'Casa container', 'Moradia, ateliê ou escritório com projeto moderno e econômico.'],
  ['🌾', 'Sítio e fazenda', 'Paiol, galpão e armazenagem resistentes ao tempo.'],
  ['🎨', 'Ateliê e estúdio', 'Um espaço próprio, do tamanho do seu projeto.'],
]
