import { describe, it, expect } from "vitest";
import { aliquotaIR, calcIR } from "../ir";

describe("aliquotaIR (tabela regressiva)", () => {
  it("22,5% até 180 dias", () => {
    expect(aliquotaIR(1)).toBe(0.225);
    expect(aliquotaIR(180)).toBe(0.225);
  });
  it("20% de 181 a 360", () => {
    expect(aliquotaIR(181)).toBe(0.2);
    expect(aliquotaIR(360)).toBe(0.2);
  });
  it("17,5% de 361 a 720", () => {
    expect(aliquotaIR(361)).toBe(0.175);
    expect(aliquotaIR(720)).toBe(0.175);
  });
  it("15% acima de 720", () => {
    expect(aliquotaIR(721)).toBe(0.15);
    expect(aliquotaIR(5000)).toBe(0.15);
  });
});

describe("calcIR", () => {
  it("aplica a alíquota sobre o rendimento", () => {
    expect(calcIR(1000, 100, false)).toEqual({ aliquota: 0.225, imposto: 225 });
    expect(calcIR(1000, 800, false)).toEqual({ aliquota: 0.15, imposto: 150 });
  });
  it("isento não paga IR", () => {
    expect(calcIR(1000, 100, true)).toEqual({ aliquota: 0, imposto: 0 });
  });
  it("rendimento não-positivo não paga IR", () => {
    expect(calcIR(0, 100, false)).toEqual({ aliquota: 0, imposto: 0 });
    expect(calcIR(-50, 100, false)).toEqual({ aliquota: 0, imposto: 0 });
  });
});
