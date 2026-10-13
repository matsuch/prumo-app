import { describe, expect, it } from "vitest";
import {
  pluggyCategoriaToClass,
  pluggyExpectedReturn,
  pluggyToHoldings,
  pluggyTotalInvested,
  pluggyTotalValue,
} from "../pluggyMapping";
import { MACRO_DEFAULT } from "../marketAssumptions";
import type { PluggyPosition } from "@/lib/pluggy/normalize";

function pos(over: Partial<PluggyPosition>): PluggyPosition {
  return {
    externalId: "x",
    categoria: "Renda fixa",
    nome: "Ativo",
    valorAtual: 0,
    valorInvestido: 0,
    rendimento: 0,
    ...over,
  };
}

describe("pluggyCategoriaToClass", () => {
  it("mapeia renda variável para acoes", () => {
    expect(pluggyCategoriaToClass("Ações/FIIs")).toBe("acoes");
    expect(pluggyCategoriaToClass("ETF")).toBe("acoes");
  });

  it("mapeia renda fixa e demais para renda_fixa", () => {
    expect(pluggyCategoriaToClass("Renda fixa")).toBe("renda_fixa");
    expect(pluggyCategoriaToClass("Fundos")).toBe("renda_fixa");
    expect(pluggyCategoriaToClass("Previdência")).toBe("renda_fixa");
    expect(pluggyCategoriaToClass("COE")).toBe("renda_fixa");
    expect(pluggyCategoriaToClass("Qualquer coisa")).toBe("renda_fixa");
  });
});

describe("pluggyExpectedReturn", () => {
  it("usa o retorno da classe (renda fixa ≈ CDI)", () => {
    expect(pluggyExpectedReturn("renda_fixa", MACRO_DEFAULT)).toBe(MACRO_DEFAULT.cdi);
    expect(pluggyExpectedReturn("acoes", MACRO_DEFAULT)).toBe(MACRO_DEFAULT.acoes);
    expect(pluggyExpectedReturn("fii", MACRO_DEFAULT)).toBe(MACRO_DEFAULT.fii);
  });
});

describe("pluggyToHoldings", () => {
  it("converte cada posição em holding pré-valorado", () => {
    const holdings = pluggyToHoldings(
      [
        pos({ categoria: "Renda fixa", valorAtual: 1000 }),
        pos({ categoria: "Ações/FIIs", valorAtual: 500 }),
      ],
      MACRO_DEFAULT,
    );
    expect(holdings).toEqual([
      { classId: "renda_fixa", value: 1000, expectedReturn: MACRO_DEFAULT.cdi },
      { classId: "acoes", value: 500, expectedReturn: MACRO_DEFAULT.acoes },
    ]);
  });
});

describe("somatórios", () => {
  const list = [
    pos({ valorAtual: 1000, valorInvestido: 800 }),
    pos({ valorAtual: 500, valorInvestido: 500 }),
  ];
  it("soma valor de mercado e investido", () => {
    expect(pluggyTotalValue(list)).toBe(1500);
    expect(pluggyTotalInvested(list)).toBe(1300);
  });
});
