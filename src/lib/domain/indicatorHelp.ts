// Explicações curtas dos indicadores fundamentalistas exibidos no painel de
// detalhe da ação (o que é + por que olhar). Chave = rótulo exato do Fundamentus.
// Conteúdo informativo/educacional — não é recomendação de investimento.

export interface IndicatorHelp {
  title: string;
  desc: string;
}

export const INDICATOR_HELP: Record<string, IndicatorHelp> = {
  "P/L": {
    title: "P/L — Preço / Lucro",
    desc: "Quantos anos do lucro atual você paga no preço da ação. Baixo pode indicar ação barata (ou lucro em queda); alto sugere expectativa de crescimento (ou ação cara). Faz mais sentido comparado a empresas do mesmo setor.",
  },
  "P/VP": {
    title: "P/VP — Preço / Valor Patrimonial",
    desc: "Compara o preço com o patrimônio líquido por ação. Abaixo de 1 significa pagar menos que o valor contábil da empresa. Muito usado para bancos e companhias intensivas em ativos.",
  },
  "P/EBIT": {
    title: "P/EBIT — Preço / Lucro Operacional",
    desc: "Como o P/L, mas sobre o lucro operacional (antes de juros e impostos). Isola a operação da estrutura de dívida e da carga tributária — bom para comparar a eficiência do negócio em si.",
  },
  PSR: {
    title: "PSR — Preço / Receita",
    desc: "Preço sobre a receita por ação. Útil para avaliar empresas com lucro instável ou negativo, quando o P/L não ajuda. Quanto menor, mais barata a ação em relação às vendas.",
  },
  "EV / EBITDA": {
    title: "EV / EBITDA",
    desc: "Valor da firma (valor de mercado + dívida − caixa) sobre a geração de caixa operacional. Múltiplo mais 'justo' que o P/L porque considera a dívida; quanto menor, tende a estar mais barata.",
  },
  "EV / EBIT": {
    title: "EV / EBIT",
    desc: "Igual ao EV/EBITDA, mas usando o lucro operacional (já descontada a depreciação). Bom para comparar empresas com muito imobilizado, onde a depreciação pesa.",
  },
  "Div. Yield": {
    title: "Dividend Yield",
    desc: "Proventos pagos nos últimos 12 meses divididos pelo preço atual. Mostra o retorno em dividendos — importante para quem busca renda. Yields muito altos nem sempre se repetem no futuro.",
  },
  ROE: {
    title: "ROE — Retorno sobre o Patrimônio",
    desc: "Lucro gerado para cada real de capital próprio dos acionistas. Mede a eficiência em gerar lucro; acima de ~15% costuma ser bom, mas verifique se não vem de endividamento alto.",
  },
  ROIC: {
    title: "ROIC — Retorno sobre o Capital Investido",
    desc: "Retorno sobre todo o capital empregado (próprio + dívida). Melhor que o ROE para julgar a qualidade do negócio, pois não é inflado pela alavancagem. Compare com o custo da dívida.",
  },
  "Marg. Bruta": {
    title: "Margem Bruta",
    desc: "Parte da receita que sobra após o custo do produto/serviço. Margem alta indica poder de precificação e vantagem competitiva.",
  },
  "Marg. EBIT": {
    title: "Margem EBIT (operacional)",
    desc: "Parte da receita que vira lucro operacional, antes de juros e impostos. Mostra a eficiência da operação principal da empresa.",
  },
  "Marg. Líquida": {
    title: "Margem Líquida",
    desc: "Parte da receita que sobra como lucro no fim, já com juros e impostos. Reúne toda a rentabilidade — útil para comparar o resultado final entre empresas.",
  },
  "EBIT / Ativo": {
    title: "EBIT / Ativo",
    desc: "Lucro operacional sobre o ativo total. Mede quanto a empresa gera com tudo o que possui, independentemente de como se financia.",
  },
  "Giro Ativos": {
    title: "Giro do Ativo",
    desc: "Receita dividida pelo ativo total: quantas vezes a empresa 'gira' seus ativos em vendas no ano. Alto indica uso eficiente dos ativos.",
  },
  "Dív Líq / Patrim": {
    title: "Dívida Líquida / Patrimônio",
    desc: "Quanto a dívida líquida representa do patrimônio dos acionistas. Mede o endividamento/alavancagem; acima de 1 costuma pedir atenção ao risco financeiro.",
  },
  "Liquidez Corr": {
    title: "Liquidez Corrente",
    desc: "Ativo circulante dividido pelo passivo circulante. Acima de 1 sugere caixa e recebíveis suficientes para as obrigações de curto prazo.",
  },
  "Cres. Rec (5a)": {
    title: "Crescimento da Receita (5 anos)",
    desc: "Crescimento médio anual da receita nos últimos 5 anos. Indica se a empresa vem expandindo as vendas de forma consistente ao longo do tempo.",
  },
  LPA: {
    title: "LPA — Lucro por Ação",
    desc: "Lucro líquido dividido pelo número de ações. É a base do P/L; crescimento consistente do LPA costuma ser sinal de um negócio saudável.",
  },
  VPA: {
    title: "VPA — Valor Patrimonial por Ação",
    desc: "Patrimônio líquido dividido pelo número de ações — o valor contábil de cada ação. É a base do P/VP.",
  },
};
