import { describe, it, expect } from "vitest";
import {
  xirr,
  accumulatedReturn,
  modifiedDietzReturn,
  rendimento,
  buildCashFlows,
  computePortfolioPerformance,
  accumulatedReturnAt,
  type CashFlow,
} from "../portfolioPerformance";

// Regra central testada aqui: FLUXO DE DINHEIRO NÃO É PERFORMANCE.
// Aportes e resgates não podem ser lidos como rendimento; só a valorização conta.

describe("Caso 1 — aporte único", () => {
  it("valor atual 11.000 sobre aporte 10.000 → rendimento 1.000 e 10%", () => {
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -10000 },
      { date: "2026-08-16", amount: 11000 },
    ];
    expect(rendimento(11000, 10000)).toBe(1000);
    // Acumulada = valor/aporte − 1 = 10%, independente do prazo.
    expect(accumulatedReturn(flows, "2026-08-16")).toBeCloseTo(0.1, 6);
  });

  it("mesmo dia (sem prazo) ainda dá 10% acumulado", () => {
    const flows: CashFlow[] = [
      { date: "2026-08-16", amount: -10000 },
      { date: "2026-08-16", amount: 11000 },
    ];
    expect(accumulatedReturn(flows)).toBeCloseTo(0.1, 6);
    expect(xirr(flows)).toBeNull(); // não dá para anualizar num único dia
  });
});

describe("Caso 2 — múltiplos aportes em datas diferentes", () => {
  const flows: CashFlow[] = [
    { date: "2026-01-01", amount: -10000 },
    { date: "2026-06-01", amount: -10000 },
    { date: "2026-08-01", amount: -10000 },
    { date: "2026-08-16", amount: 31500 },
  ];

  it("rendimento é 1.500 (valor − capital), mas a rentabilidade NÃO é 5%", () => {
    expect(rendimento(31500, 30000)).toBe(1500);
    const acc = accumulatedReturn(flows, "2026-08-16");
    expect(acc).not.toBeNull();
    // 1.500 / 30.000 = 5% seria o cálculo ERRADO (ignora o tempo de cada aporte).
    expect(acc).not.toBeCloseTo(0.05, 3);
    expect(acc as number).toBeGreaterThan(0);
  });

  it("a anualizada (XIRR) é maior que a acumulada num período < 1 ano", () => {
    const anual = xirr(flows) as number;
    const acc = accumulatedReturn(flows, "2026-08-16") as number;
    expect(anual).toBeGreaterThan(acc); // capital ficou pouco tempo → anualizado alto
  });
});

describe("Caso 3 — resgate não é prejuízo", () => {
  const flows: CashFlow[] = [
    { date: "2026-01-01", amount: -20000 }, // aporte
    { date: "2026-06-01", amount: 5000 }, // resgate
    { date: "2026-08-16", amount: 16000 }, // valor atual
  ];

  it("capital líquido 15.000, valor 16.000 → rendimento 1.000 (positivo)", () => {
    expect(rendimento(16000, 15000)).toBe(1000);
  });

  it("rentabilidade não é negativa por causa do resgate", () => {
    const acc = accumulatedReturn(flows, "2026-08-16");
    expect(acc as number).toBeGreaterThan(0);
  });
});

describe("Caso 4 — aporte no mês não infla a rentabilidade mensal", () => {
  it("início 30.000, aporte 10.000 no meio, fim 41.000 → ganho 1.000", () => {
    const r = modifiedDietzReturn(30000, 41000, "2026-08-01", "2026-08-31", [
      { date: "2026-08-16", amount: 10000 }, // aporte (ótica do patrimônio: +)
    ]);
    // Ganho real = 41.000 − 30.000 − 10.000 = 1.000, NÃO 11.000.
    // Base ponderada = 30.000 + 10.000 * (15/30) = 35.000 → 1.000/35.000.
    expect(r).toBeCloseTo(1000 / 35000, 6);
    // O cálculo ingênuo (11.000/30.000 ≈ 36,7%) seria muito maior.
    expect(r as number).toBeLessThan(0.1);
  });
});

describe("Caso 5 — Meta convertida em investimento vira aporte", () => {
  it("meta direcionada entra como fluxo de aporte (negativo), não como ganho", () => {
    // Sem a meta: só o aporte inicial.
    const semMeta: CashFlow[] = [
      { date: "2026-01-01", amount: -10000 },
      { date: "2026-08-16", amount: 11000 },
    ];
    // Com a meta de 1.000 investida em 01/08: novo APORTE (−1.000), e o valor
    // atual sobe pelo próprio aporte (11.000 → 12.000), sem virar rendimento.
    const comMeta: CashFlow[] = [
      { date: "2026-01-01", amount: -10000 },
      { date: "2026-08-01", amount: -1000 }, // meta → aporte
      { date: "2026-08-16", amount: 12000 },
    ];
    expect(rendimento(12000, 11000)).toBe(1000); // mesmo rendimento de antes
    const accSem = accumulatedReturn(semMeta, "2026-08-16") as number;
    const accCom = accumulatedReturn(comMeta, "2026-08-16") as number;
    // A meta não pode aumentar artificialmente a rentabilidade.
    expect(accCom).toBeLessThanOrEqual(accSem + 1e-9);
  });
});

describe("Caso 6 — sem movimentação", () => {
  it("sem valorização, rendimento 0 e rentabilidade 0%", () => {
    const flows: CashFlow[] = [
      { date: "2026-01-01", amount: -10000 },
      { date: "2026-08-16", amount: 10000 },
    ];
    expect(rendimento(10000, 10000)).toBe(0);
    expect(accumulatedReturn(flows, "2026-08-16")).toBeCloseTo(0, 6);
    expect(xirr(flows)).toBeCloseTo(0, 6);
  });
});

describe("Caso 7 — comparação mensal em pontos percentuais", () => {
  it("a diferença exibida é acumulada_agora − acumulada_antes (pp)", () => {
    const atual = 0.0524;
    const anterior = 0.044;
    const pp = (atual - anterior) * 100;
    expect(pp).toBeCloseTo(0.84, 6); // +0,84 pp (não 5,24/4,40 − 1)
  });
});

describe("buildCashFlows — derivação a partir do investido dos snapshots", () => {
  it("cada variação do investido vira aporte/resgate datado", () => {
    const flows = buildCashFlows(
      [
        { date: "2026-01-01", investido: 10000 },
        { date: "2026-06-01", investido: 20000 }, // +10.000 aporte
        { date: "2026-08-01", investido: 30000 }, // +10.000 aporte
      ],
      { date: "2026-08-16", patrimonio: 31500 },
    );
    expect(flows).toEqual([
      { date: "2026-01-01", amount: -10000 },
      { date: "2026-06-01", amount: -10000 },
      { date: "2026-08-01", amount: -10000 },
      { date: "2026-08-16", amount: 31500 },
    ]);
  });

  it("investido que cai gera resgate (fluxo positivo)", () => {
    const flows = buildCashFlows(
      [
        { date: "2026-01-01", investido: 20000 },
        { date: "2026-06-01", investido: 15000 }, // −5.000 resgate
      ],
      { date: "2026-08-16", patrimonio: 16000 },
    );
    expect(flows).toEqual([
      { date: "2026-01-01", amount: -20000 },
      { date: "2026-06-01", amount: 5000 },
      { date: "2026-08-16", amount: 16000 },
    ]);
  });
});

describe("computePortfolioPerformance — serviço consumido pelo dashboard", () => {
  it("sem histórico, acumulada cai para o retorno simples", () => {
    const perf = computePortfolioPerformance({
      series: [],
      today: "2026-08-16",
      patrimonio: 11000,
      investido: 10000,
    });
    expect(perf.rendimento).toBe(1000);
    expect(perf.rentabilidadeAcumulada).toBeCloseTo(0.1, 6);
    expect(perf.rentabilidadeAnualizada).toBeNull();
  });

  it("com histórico de aportes, usa money-weighted (≠ retorno simples)", () => {
    const perf = computePortfolioPerformance({
      series: [
        { date: "2026-01-01", investido: 10000 },
        { date: "2026-06-01", investido: 20000 },
        { date: "2026-08-01", investido: 30000 },
      ],
      today: "2026-08-16",
      patrimonio: 31500,
      investido: 30000,
    });
    expect(perf.rendimento).toBe(1500);
    expect(perf.rentabilidadeAcumulada).not.toBeCloseTo(0.05, 3);
    expect(perf.rentabilidadeAnualizada as number).toBeGreaterThan(0);
  });
});

describe("accumulatedReturnAt — base da comparação mensal", () => {
  it("calcula a acumulada até uma data passada", () => {
    const series = [
      { date: "2026-01-01", investido: 10000 },
      { date: "2026-07-01", investido: 20000 },
    ];
    const acc = accumulatedReturnAt(series, {
      date: "2026-07-16",
      patrimonio: 20500,
      investido: 20000,
    });
    expect(acc).not.toBeNull();
    expect(acc as number).toBeGreaterThan(0);
  });
});
