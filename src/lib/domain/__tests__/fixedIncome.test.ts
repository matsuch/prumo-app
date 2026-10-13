import { describe, it, expect } from "vitest";
import { calcFixedIncome, type FixedIncomePosition, type Series } from "../fixedIncome";
import type { SeriePonto } from "@/lib/market/bacen";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const emptySeries: Series = { cdi: [], selic: [], ipca: [] };

function pos(over: Partial<FixedIncomePosition>): FixedIncomePosition {
  return {
    id: "x",
    emissor: "Teste",
    indexador: "PREFIXADO",
    taxa: 12,
    valorAplicado: 1000,
    dataAplicacao: "2024-01-02",
    ...over,
  };
}

describe("calcFixedIncome — prefixado", () => {
  it("anualiza exatamente à taxa contratada (base 252), independente do prazo", () => {
    const r = calcFixedIncome(pos({ taxa: 12 }), d("2026-01-02"), emptySeries);
    expect(r.rentabilidadeAnual).toBeCloseTo(0.12, 6);
    expect(r.valorAtual).toBeGreaterThan(1000);
  });

  it("aplica IR de 15% (>720 dias corridos) sobre o rendimento", () => {
    const r = calcFixedIncome(pos({ taxa: 12 }), d("2026-01-02"), emptySeries);
    expect(r.aliquotaIR).toBe(0.15);
    expect(r.imposto).toBeCloseTo(r.rendimento * 0.15, 6);
    expect(r.valorLiquido).toBeCloseTo(r.valorAtual - r.imposto, 6);
    expect(r.rendimentoLiquido).toBeCloseTo(r.rendimento - r.imposto, 6);
  });

  it("isento zera o IR", () => {
    const r = calcFixedIncome(pos({ taxa: 12, isento: true }), d("2026-01-02"), emptySeries);
    expect(r.imposto).toBe(0);
    expect(r.valorLiquido).toBe(r.valorAtual);
  });
});

describe("calcFixedIncome — CDI", () => {
  it("acumula os fatores diários da série (100% do CDI)", () => {
    // 3 dias úteis com CDI de 0,04% ao dia
    const cdi: SeriePonto[] = [
      { data: d("2025-06-10"), valor: 0.04 },
      { data: d("2025-06-11"), valor: 0.04 },
      { data: d("2025-06-12"), valor: 0.04 },
    ];
    const r = calcFixedIncome(
      pos({ indexador: "CDI", taxa: 100, dataAplicacao: "2025-06-09" }),
      d("2025-06-13"),
      { cdi, selic: [], ipca: [] },
    );
    const esperado = 1000 * Math.pow(1.0004, 3);
    expect(r.valorAtual).toBeCloseTo(esperado, 6);
  });

  it("110% do CDI rende mais que 100%", () => {
    const cdi: SeriePonto[] = [
      { data: d("2025-06-10"), valor: 0.05 },
      { data: d("2025-06-11"), valor: 0.05 },
    ];
    const series = { cdi, selic: [], ipca: [] };
    const base = pos({ indexador: "CDI", taxa: 100, dataAplicacao: "2025-06-09" });
    const r100 = calcFixedIncome(base, d("2025-06-12"), series);
    const r110 = calcFixedIncome({ ...base, taxa: 110 }, d("2025-06-12"), series);
    expect(r110.valorAtual).toBeGreaterThan(r100.valorAtual);
  });
});

describe("calcFixedIncome — IPCA+", () => {
  it("acumula o IPCA mensal (spread 0 isola o índice)", () => {
    const ipca: SeriePonto[] = [
      { data: d("2025-01-01"), valor: 0.5 },
      { data: d("2025-02-01"), valor: 0.5 },
    ];
    const r = calcFixedIncome(
      pos({ indexador: "IPCA", taxa: 0, dataAplicacao: "2025-01-01" }),
      d("2025-03-01"),
      { cdi: [], selic: [], ipca },
    );
    expect(r.valorAtual).toBeCloseTo(1000 * 1.005 * 1.005, 6);
  });
});
