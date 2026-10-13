import { describe, it, expect } from "vitest";
import {
  makeGrowthToEnd,
  benchmarkAccumulated,
  pctOfBenchmark,
  type IndexPoint,
} from "../benchmark";
import type { CashFlow } from "../portfolioPerformance";

describe("makeGrowthToEnd", () => {
  const pts: IndexPoint[] = [
    { date: "2026-01-01", factor: 100 },
    { date: "2026-02-01", factor: 110 },
    { date: "2026-03-01", factor: 121 },
  ];
  it("cresce da data até o fim da série (fim/naData)", () => {
    const g = makeGrowthToEnd(pts);
    expect(g("2026-01-01")).toBeCloseTo(1.21, 5); // 121/100
    expect(g("2026-02-01")).toBeCloseTo(1.1, 5); // 121/110
    expect(g("2026-03-01")).toBeCloseTo(1, 5); // 121/121
  });
  it("usa o pregão anterior (último ponto <= data)", () => {
    const g = makeGrowthToEnd(pts);
    expect(g("2026-02-15")).toBeCloseTo(1.1, 5); // cai no ponto de 01/02
  });
  it("antes do primeiro ponto usa o primeiro; série vazia → 1", () => {
    const g = makeGrowthToEnd(pts);
    expect(g("2025-12-01")).toBeCloseTo(1.21, 5);
    expect(makeGrowthToEnd([])("2026-01-01")).toBe(1);
  });
});

describe("benchmarkAccumulated", () => {
  // Índice que dobra da 1ª data até o fim, e cresce 10% da 2ª data até o fim.
  const growth = makeGrowthToEnd([
    { date: "2026-01-01", factor: 100 },
    { date: "2026-06-01", factor: 182 }, // 182/? — usamos direto abaixo
    { date: "2026-07-01", factor: 200 },
  ]);

  it("aporte único cresce pelo índice", () => {
    // Aporte de 1000 em 01/01 (amount −1000). growth(01/01) = 200/100 = 2.
    const contribs: CashFlow[] = [{ date: "2026-01-01", amount: -1000 }];
    const r = benchmarkAccumulated(contribs, growth)!;
    expect(r.capital).toBe(1000);
    expect(r.valorFinal).toBeCloseTo(2000, 5);
    expect(r.acumulada).toBeCloseTo(1, 5); // +100%
  });

  it("dois aportes em datas diferentes ponderam pelo crescimento de cada um", () => {
    const contribs: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 }, // ×2 → 2000
      { date: "2026-07-01", amount: -1000 }, // ×1 → 1000
    ];
    const r = benchmarkAccumulated(contribs, growth)!;
    expect(r.capital).toBe(2000);
    expect(r.valorFinal).toBeCloseTo(3000, 5);
    expect(r.acumulada).toBeCloseTo(0.5, 5); // 3000/2000 − 1
  });

  it("resgate remove capital que teria crescido", () => {
    const contribs: CashFlow[] = [
      { date: "2026-01-01", amount: -1000 }, // aporte
      { date: "2026-07-01", amount: 400 }, // resgate (não cresce mais)
    ];
    const r = benchmarkAccumulated(contribs, growth)!;
    expect(r.capital).toBe(600); // 1000 − 400
    expect(r.valorFinal).toBeCloseTo(1600, 5); // 2000 − 400
  });

  it("sem capital positivo → null", () => {
    expect(benchmarkAccumulated([], growth)).toBeNull();
    expect(benchmarkAccumulated([{ date: "2026-01-01", amount: 500 }], growth)).toBeNull();
  });
});

describe("pctOfBenchmark", () => {
  it("carteira vs benchmark no mesmo período", () => {
    expect(pctOfBenchmark(0.08, 0.05)).toBeCloseTo(1.6, 5); // 160% do CDI
    expect(pctOfBenchmark(0.03, 0.05)).toBeCloseTo(0.6, 5);
  });
  it("benchmark ~0 → null", () => {
    expect(pctOfBenchmark(0.08, 0)).toBeNull();
  });
});
