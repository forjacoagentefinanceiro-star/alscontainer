// Nomes legíveis do Mapa do Pátio (mesmos do mapa em lib/patio/mapaHtml.ts)
export const ARMADOR_NOME: Record<string, string> = {
  maersk: 'Maersk', hapag: 'Hapag-Lloyd', evergreen: 'Evergreen', login: 'Log-In', one: 'ONE',
  valle: 'Valle (vazio)', cheio: 'Cheio', livre: 'Livre', oficina: 'Oficina',
}
export const SITUACAO_NOME: Record<string, string> = {
  OK: 'OK', AV: 'Avariado', SOF: 'OK reparado', SAINDO: 'Saindo', VENDA: 'Venda', DESCARGA: 'Descarga',
  CHEIO: 'Cheio', VAZIO: 'Vazio', OFICINA: 'Oficina', LIVRE: 'Livre', NA: 'Não informada',
}
export const PILHA_NOME: Record<string, string> = { completa: 'Completa', parcial: 'Parcial', vazia: 'Vazia' }
export const TAMANHO_NOME: Record<string, string> = { '40': "40'", '20': "2 × 20'", '20u': "1 × 20'" }

// 'R1 E (após galpão)|E9.A' → 'R1 E9.A'
export function nomePosicao(chave: string) {
  const i = chave.indexOf('|')
  return i < 0 ? chave : `${chave.slice(0, i).split(' ')[0]} ${chave.slice(i + 1)}`
}
