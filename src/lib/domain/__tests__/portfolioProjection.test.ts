import { describe, it, expect } from "vitest";
import { buildProjectionInputs } from "../portfolioProjection";
import type { FixedIncomePosition } from "../fixedIncome";
import type { StockPosition } from "../stocks";

const fixed: FixedIncomePosition[] = [
  {
    id: "f1",
    emissor: "CDB",
    indexador: "CDI",
    taxa: 110,
    valorAplicado: 10000,
    dataAplicacao: "2024-01-02",
  },
];
const stocks: StockPosition[] = [
  { id: "s1", ticker: "PETR4", quantidade: 100, precoCompra: 30, dataCompra: "2024-01-02" },
  { id: "s2", ticker: "HGLG11", quantidade: 50, precoCompra: 160, dataCompra: "2024-01-02" },
];

describe("buildProjectionInputs", () => {
  it("agrega o valor atual por classe e separa ação de FII pelo ticker", () => {
    const fixedValues = { f1: 12000 };
    const stockValues = { s1: 4000, s2: 9000 };
    const inputs = buildProjectionInputs(fixed, stocks, fixedValues, stockValues, 0);

    expect(inputs.byClassValue.renda_fixa).toBe(12000);
    expect(inputs.byClassValue.acoes).toBe(4000); // PETR4
    expect(inputs.byClassValue.fii).toBe(9000); // HGLG11
    expect(inputs.totalValue).toBe(25000);
  });

  it("distribui o aporte mensal pelo peso de cada classe", () => {
    const inputs = buildProjectionInputs(
      fixed,
      stocks,
      { f1: 10000 },
      { s1: 0, s2: 0 },
      900, // aporte total
    );
    // renda_fixa tem 100% do valor (ações/FIIs zeradas) → recebe todo o aporte
    const rf = inputs.holdings.find((h) => h.classId === "renda_fixa");
    expect(rf?.monthlyContribution).toBeCloseTo(900, 6);
  });

  it("ignora classes sem valor", () => {
    const inputs = buildProjectionInputs(fixed, [], { f1: 5000 }, {}, 0);
    expect(inputs.classes.map((c) => c.id)).toEqual(["renda_fixa"]);
  });
});
