import { describe, it, expect } from "vitest";
import { analyzeGoal, anosAte } from "../goalPlanning";

// Projeção linear no aporte: base(a) = 1000 + a*10.
const projLinear = (a: number) => 1000 + a * 10;

describe("analyzeGoal", () => {
  it("calcula projetado, atingimento e progresso", () => {
    const r = analyzeGoal(3000, 10, 1000, 100, projLinear);
    expect(r.projetado).toBe(2000); // 1000 + 100*10
    expect(r.atinge).toBe(false);
    expect(r.progressoHoje).toBeCloseTo(1 / 3, 6);
  });

  it("resolve o aporte necessário para bater a meta", () => {
    // base0=1000, k=10 → (3000-1000)/10 = 200
    const r = analyzeGoal(3000, 10, 1000, 100, projLinear);
    expect(r.aporteNecessario).toBeCloseTo(200, 6);
  });

  it("aporte necessário 0 quando já projeta atingir sem aportes", () => {
    const r = analyzeGoal(800, 10, 1000, 0, projLinear); // base0=1000 >= 800
    expect(r.aporteNecessario).toBe(0);
    expect(r.atinge).toBe(true);
  });

  it("marca atingido quando o aporte da meta é suficiente", () => {
    const r = analyzeGoal(2000, 10, 1000, 100, projLinear); // projetado 2000 >= 2000
    expect(r.atinge).toBe(true);
  });
});

describe("anosAte", () => {
  it("data passada retorna 0", () => {
    expect(anosAte("2000-01-01")).toBe(0);
  });
  it("data futura retorna anos positivos", () => {
    const futuro = new Date(Date.now() + 365 * 2 * 86_400_000).toISOString().slice(0, 10);
    expect(anosAte(futuro)).toBeGreaterThan(1.5);
  });
});
