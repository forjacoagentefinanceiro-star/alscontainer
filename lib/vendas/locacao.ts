// Cálculo da proposta de locação (receita, custos e margem líquida). Puro: roda no servidor e no navegador.
export type Modo = 'cheio' | 'proporcional'   // cheio = fornecedor cobra o mês inteiro (ou múltiplos de 30 dias)
export type ItemLoc = {
  qtd: number; unit: number                   // unit = diária cobrada do cliente
  origem?: 'proprio' | 'terceiro'
  custo_mensal?: number | null                // terceiro: mensalidade paga ao fornecedor · próprio: custo opcional (manutenção/depreciação)
  modo?: Modo
}
export type ExtrasLoc = {
  inicio?: string                             // aaaa-mm-dd
  frete_cobrado?: number; taxa_cobrada?: number            // receitas extras (cliente)
  frete_pago?: number; outros_custos?: number              // custos (admin)
  imposto_pct?: number; comissao_pct?: number              // % sobre a receita (admin)
}

export const mesesCobrados = (dias: number, modo: Modo = 'cheio') =>
  modo === 'cheio' ? Math.max(1, Math.ceil(dias / 30)) : dias / 30

export function calcLocacao(itens: ItemLoc[], dias: number, ex: ExtrasLoc = {}) {
  const alug = itens.reduce((s, i) => s + i.qtd * i.unit * dias, 0)
  const freteCob = ex.frete_cobrado ?? 0, taxa = ex.taxa_cobrada ?? 0
  const receita = alug + freteCob + taxa
  let custoTerc = 0, custoProp = 0
  for (const i of itens) {
    const c = i.qtd * (i.custo_mensal ?? 0) * mesesCobrados(dias, i.modo ?? (i.origem === 'proprio' ? 'proporcional' : 'cheio'))
    if (i.origem === 'proprio') custoProp += c; else custoTerc += c
  }
  const fretePago = ex.frete_pago ?? 0, outros = ex.outros_custos ?? 0
  const imposto = receita * (ex.imposto_pct ?? 0) / 100, comissao = receita * (ex.comissao_pct ?? 0) / 100
  const custoFixo = custoTerc + custoProp + fretePago + outros
  const custo = custoFixo + imposto + comissao
  const lucro = receita - custo
  const pctVar = ((ex.imposto_pct ?? 0) + (ex.comissao_pct ?? 0)) / 100
  const diasUn = itens.reduce((s, i) => s + i.qtd * dias, 0)   // unidades-dia
  // receita que zera o lucro e a diária média que isso exige
  const receitaEmpate = pctVar < 1 ? custoFixo / (1 - pctVar) : 0
  const diariaEmpate = diasUn > 0 ? Math.max(0, receitaEmpate - freteCob - taxa) / diasUn : 0
  return {
    alug, receita, custoTerc, custoProp, fretePago, outros, imposto, comissao, custo, lucro,
    margem: receita > 0 ? (lucro / receita) * 100 : 0,
    markup: custo > 0 ? (lucro / custo) * 100 : null as number | null,
    diariaEmpate,
  }
}
