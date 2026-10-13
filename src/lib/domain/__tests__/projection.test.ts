import { describe, it, expect } from "vitest";
import {
  projectPortfolio,
  passiveIncomeMonthly,
  totalContributed,
  type Holding,
} from "../projection";
import type { AssetClass } from "../assets";

// Classe de retorno ZERO para tornar a matemática determinística.
const zeroClass: AssetClass = {
  id: "rf",
  label: "RF",
  color: "#000",
  returns: { pessimista: 0, base: 0, otimista: 0 },
};

describe("projectPortfolio", () => {
  it("sem retorno e sem aporte, o patrimônio não muda", () => {
    const holdings: Holding[] = [{ classId: "rf", currentValue: 1000, monthlyContribution: 0 }];
    const pts = projectPortfolio(holdings, "base", 10, [zeroClass]);
    expect(pts[0].total).toBe(1000);
    expect(pts[pts.length - 1].total).toBeCloseTo(1000, 6);
  });

  it("sem retorno, soma os aportes mensais", () => {
    const holdings: Holding[] = [{ classId: "rf", currentValue: 1000, monthlyContribution: 100 }];
    const pts = projectPortfolio(holdings, "base", 1, [zeroClass]);
    // 1000 + 100 * 12
    expect(pts[pts.length - 1].total).toBeCloseTo(2200, 6);
  });

  it("retorno positivo faz o patrimônio crescer", () => {
    const rf10: AssetClass = { ...zeroClass, returns: { pessimista: 0.1, base: 0.1, otimista: 0.1 } };
    const holdings: Holding[] = [{ classId: "rf", currentValue: 1000, monthlyContribution: 0 }];
    const pts = projectPortfolio(holdings, "base", 1, [rf10]);
    expect(pts[pts.length - 1].total).toBeCloseTo(1100, 0); // ~+10% no ano
  });
});

describe("helpers de projeção", () => {
  it("passiveIncomeMonthly usa 4% a.a. por padrão", () => {
    expect(passiveIncomeMonthly(120000)).toBeCloseTo(400, 6); // 120000*0.04/12
  });
  it("totalContributed soma inicial + aportes no período", () => {
    const holdings: Holding[] = [{ classId: "rf", currentValue: 1000, monthlyContribution: 100 }];
    expect(totalContributed(holdings, 1)).toBe(1000 + 100 * 12);
  });
});
