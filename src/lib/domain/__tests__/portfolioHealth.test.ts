import { describe, it, expect } from "vitest";
import { analyzePortfolioHealth, mediaSemOutliers, type HealthInput } from "../portfolioHealth";

function base(over: Partial<HealthInput> = {}): HealthInput {
  return {
    patrimonio: 100_000,
    liquidez: 30_000,
    custoFixoMensal: 3_000,
    cartaoMensal: 2_000,
    rendaFixaValor: 40_000,
    acoesFiiValor: 60_000,
    holdings: [
      { nome: "PETR4", valor: 15_000 },
      { nome: "Tesouro IPCA", valor: 40_000 },
    ],
    ...over,
  };
}

function find(list: ReturnType<typeof analyzePortfolioHealth>, needle: string) {
  return list.find((s) => s.title.includes(needle));
}

describe("reserva de emergência", () => {
  it("< 3 meses → alert", () => {
    const s = analyzePortfolioHealth(base({ liquidez: 10_000 })); // 2 meses
    expect(find(s, "Reserva")?.level).toBe("alert");
  });
  it("3–6 meses → warn", () => {
    const s = analyzePortfolioHealth(base({ liquidez: 20_000 })); // 4 meses
    expect(find(s, "Reserva")?.level).toBe("warn");
  });
  it(">= 6 meses → ok", () => {
    const s = analyzePortfolioHealth(base({ liquidez: 40_000 })); // 8 meses
    expect(find(s, "Reserva")?.level).toBe("ok");
  });
  it("sem custo mensal → não avalia reserva", () => {
    const s = analyzePortfolioHealth(base({ custoFixoMensal: 0, cartaoMensal: 0 }));
    expect(find(s, "Reserva")).toBeUndefined();
  });
  it("custo de vida = fatura do cartão + gastos fixos (não só os fixos)", () => {
    // 30 mil / 3 mil de fixos seriam 10 meses; somando o cartão (2 mil) são 6.
    const s = analyzePortfolioHealth(base({ liquidez: 30_000, cartaoMensal: 2_000 }));
    const r = find(s, "Reserva");
    expect(r?.title).toContain("6,0 meses");
    expect(r?.detail).toContain("meta de 6 meses");
  });
});

describe("mediaSemOutliers", () => {
  it("descarta mês fora de 1,5×IQR", () => {
    const r = mediaSemOutliers([2000, 2100, 1900, 2050, 1950, 2000, 9000]);
    expect(r.excluidos).toBe(1);
    expect(r.usados).toBe(6);
    expect(r.media).toBe(2000);
  });
  it("ignora meses sem valor", () => {
    expect(mediaSemOutliers([0, 0, 1000, 3000])).toEqual({ media: 2000, usados: 2, excluidos: 0 });
  });
  it("sem dados → zero", () => {
    expect(mediaSemOutliers([]).media).toBe(0);
  });
});

describe("concentração", () => {
  it("> 30% da maior posição → alert com o nome", () => {
    const s = analyzePortfolioHealth(
      base({ patrimonio: 100_000, holdings: [{ nome: "VALE3", valor: 40_000 }] }),
    );
    const c = find(s, "Concentração");
    expect(c?.level).toBe("alert");
    expect(c?.title).toContain("VALE3");
    expect(c?.title).toContain("40%");
  });
  it("20–30% → warn", () => {
    const s = analyzePortfolioHealth(
      base({ patrimonio: 100_000, holdings: [{ nome: "ITUB4", valor: 25_000 }] }),
    );
    expect(find(s, "ITUB4")?.level).toBe("warn");
  });
  it("<= 20% → sem alerta de concentração", () => {
    const s = analyzePortfolioHealth(
      base({ patrimonio: 100_000, holdings: [{ nome: "BBAS3", valor: 10_000 }] }),
    );
    expect(find(s, "BBAS3")).toBeUndefined();
    expect(find(s, "Concentração")).toBeUndefined();
  });
});

describe("diversificação", () => {
  it("bolsa sem renda fixa → warn", () => {
    const s = analyzePortfolioHealth(base({ rendaFixaValor: 0, acoesFiiValor: 100_000 }));
    expect(find(s, "sem renda fixa")?.level).toBe("warn");
  });
  it("com renda fixa → sem esse alerta", () => {
    const s = analyzePortfolioHealth(base({ rendaFixaValor: 40_000 }));
    expect(find(s, "sem renda fixa")).toBeUndefined();
  });
});

describe("ordenação", () => {
  it("alerts vêm antes de warns e oks", () => {
    const s = analyzePortfolioHealth(
      base({
        liquidez: 10_000, // reserva alert (2 meses)
        patrimonio: 100_000,
        holdings: [{ nome: "PETR4", valor: 25_000 }], // concentração warn
      }),
    );
    const rank = { alert: 0, warn: 1, ok: 2 } as const;
    const ranks = s.map((x) => rank[x.level]);
    // Ranks em ordem não-decrescente: alerts primeiro, depois warns, depois oks.
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(s[0].level).toBe("alert");
  });
});
