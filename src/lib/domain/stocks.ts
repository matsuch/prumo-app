// Cálculo de rentabilidade realizada de ações/FIIs, a partir do preço de
// compra informado e da cotação atual (brapi).

export interface StockPosition {
  id: string;
  ticker: string;
  quantidade: number;
  precoCompra: number; // preço médio pago por cota/ação
  dataCompra: string; // ISO yyyy-mm-dd
}

export interface StockResult {
  precoAtual: number | null;
  valorInvestido: number;
  valorAtual: number | null;
  rendimento: number | null;
  rentabilidade: number | null; // decimal
  rentabilidadeAnual: number | null; // decimal
}

const MS_DIA = 86_400_000;

export function calcStock(
  pos: StockPosition,
  precoAtual: number | null,
  hoje: Date,
): StockResult {
  const valorInvestido = pos.quantidade * pos.precoCompra;
  if (precoAtual == null || pos.precoCompra <= 0) {
    return {
      precoAtual,
      valorInvestido,
      valorAtual: null,
      rendimento: null,
      rentabilidade: null,
      rentabilidadeAnual: null,
    };
  }

  const valorAtual = pos.quantidade * precoAtual;
  const rentabilidade = precoAtual / pos.precoCompra - 1;
  const anos = Math.max(
    (hoje.getTime() - new Date(`${pos.dataCompra}T00:00:00Z`).getTime()) / (MS_DIA * 365.25),
    0,
  );

  return {
    precoAtual,
    valorInvestido,
    valorAtual,
    rendimento: valorAtual - valorInvestido,
    rentabilidade,
    rentabilidadeAnual: anos > 0 ? Math.pow(1 + rentabilidade, 1 / anos) - 1 : rentabilidade,
  };
}
