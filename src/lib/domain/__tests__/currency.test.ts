import { describe, it, expect } from "vitest";
import { formatCompactAxis, formatMoneyInput, parseMoneyInput } from "../currency";

// Rótulo do eixo Y dos gráficos no celular: tem que caber em ~40px de margem,
// então é curto por construção (sem "R$" e sem separador de milhar).
describe("formatCompactAxis", () => {
  it("usa M para milhões, com uma casa decimal", () => {
    expect(formatCompactAxis(1_000_000)).toBe("1,0M");
    expect(formatCompactAxis(2_450_000)).toBe("2,5M");
  });

  it("usa k para milhares, arredondando", () => {
    expect(formatCompactAxis(1_000)).toBe("1k");
    expect(formatCompactAxis(184_320)).toBe("184k");
    expect(formatCompactAxis(999_500)).toBe("1000k");
  });

  it("mostra o número cheio abaixo de mil", () => {
    expect(formatCompactAxis(0)).toBe("0");
    expect(formatCompactAxis(850.4)).toBe("850");
  });

  it("preserva o sinal de valores negativos", () => {
    expect(formatCompactAxis(-2_000)).toBe("-2k");
    expect(formatCompactAxis(-3_100_000)).toBe("-3,1M");
  });
});

// Campo de R$ com máscara estilo caixa: dígitos entram pela direita.
describe("máscara de dinheiro", () => {
  it("os dois últimos dígitos são centavos, sem zero à esquerda", () => {
    expect(parseMoneyInput("13299")).toBe(132.99);
    expect(formatMoneyInput(132.99)).toBe("132,99");
    expect(parseMoneyInput("5")).toBe(0.05);
    expect(formatMoneyInput(0.05)).toBe("0,05");
  });

  it("digitar mais um dígito empurra o valor para a esquerda", () => {
    expect(parseMoneyInput("132,995", "132,99")).toBe(1329.95);
    expect(formatMoneyInput(1329.95)).toBe("1.329,95");
  });

  it("apagar remove o último dígito, inclusive quando apaga um separador", () => {
    expect(parseMoneyInput("132,9", "132,99")).toBe(13.29);
    expect(parseMoneyInput("1329,95", "1.329,95")).toBe(132.99);
    expect(parseMoneyInput("", "0,05")).toBe(0);
  });

  it("zero vira campo vazio para mostrar o placeholder", () => {
    expect(formatMoneyInput(0)).toBe("");
    expect(formatMoneyInput(Number.NaN)).toBe("");
  });

  it("valores inteiros antigos aparecem com centavos", () => {
    expect(formatMoneyInput(1500)).toBe("1.500,00");
  });
});
