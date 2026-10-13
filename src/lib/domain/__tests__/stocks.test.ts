import { describe, it, expect } from "vitest";
import { calcStock, type StockPosition } from "../stocks";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const pos: StockPosition = {
  id: "s",
  ticker: "PETR4",
  quantidade: 100,
  precoCompra: 30,
  dataCompra: "2025-01-01",
};

describe("calcStock", () => {
  it("calcula valor, rendimento e rentabilidade", () => {
    const r = calcStock(pos, 60, d("2026-01-01"));
    expect(r.valorInvestido).toBe(3000);
    expect(r.valorAtual).toBe(6000);
    expect(r.rendimento).toBe(3000);
    expect(r.rentabilidade).toBeCloseTo(1.0, 6);
    expect(r.rentabilidadeAnual).toBeCloseTo(1.0, 1); // ~1 ano
  });

  it("preço atual nulo → resultados nulos, mas mantém o investido", () => {
    const r = calcStock(pos, null, d("2026-01-01"));
    expect(r.valorInvestido).toBe(3000);
    expect(r.valorAtual).toBeNull();
    expect(r.rendimento).toBeNull();
    expect(r.rentabilidade).toBeNull();
  });

  it("prejuízo é refletido no sinal negativo", () => {
    const r = calcStock(pos, 24, d("2026-01-01"));
    expect(r.rendimento).toBe(-600);
    expect(r.rentabilidade).toBeCloseTo(-0.2, 6);
  });
});
