import { describe, it, expect } from "vitest";
import { isFII, rfExpectedNominal, scenarioReturns, MACRO_DEFAULT } from "../marketAssumptions";
import type { FixedIncomePosition } from "../fixedIncome";

const base: FixedIncomePosition = {
  id: "x",
  emissor: "t",
  indexador: "PREFIXADO",
  taxa: 12,
  valorAplicado: 1000,
  dataAplicacao: "2025-01-01",
};

describe("isFII", () => {
  it("ticker terminando em 11 é FII", () => {
    expect(isFII("HGLG11")).toBe(true);
    expect(isFII("mxrf11")).toBe(true);
    expect(isFII("PETR4")).toBe(false);
  });
});

describe("rfExpectedNominal", () => {
  it("prefixado usa a própria taxa", () => {
    expect(rfExpectedNominal({ ...base, indexador: "PREFIXADO", taxa: 12 }, MACRO_DEFAULT)).toBeCloseTo(
      0.12,
      6,
    );
  });
  it("CDI é percentual do CDI esperado", () => {
    expect(rfExpectedNominal({ ...base, indexador: "CDI", taxa: 110 }, MACRO_DEFAULT)).toBeCloseTo(
      1.1 * MACRO_DEFAULT.cdi,
      6,
    );
  });
  it("IPCA+ compõe inflação esperada e spread", () => {
    expect(rfExpectedNominal({ ...base, indexador: "IPCA", taxa: 6 }, MACRO_DEFAULT)).toBeCloseTo(
      (1 + MACRO_DEFAULT.ipca) * 1.06 - 1,
      6,
    );
  });
});

describe("scenarioReturns", () => {
  it("deriva cenários com a amplitude da classe", () => {
    expect(scenarioReturns(0.06, "renda_fixa")).toEqual({
      pessimista: 0.045,
      base: 0.06,
      otimista: 0.075,
    });
    expect(scenarioReturns(0.07, "acoes").otimista).toBeCloseTo(0.12, 6);
  });
  it("não deixa o cenário pessimista ficar negativo", () => {
    expect(scenarioReturns(0.01, "renda_fixa").pessimista).toBe(0);
  });
});
