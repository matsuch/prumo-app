import { describe, expect, it } from "vitest";
import { itensDoMes, somaItens, type MonthlyIncome } from "@/lib/supabase/income";

const incomes: MonthlyIncome[] = [
  { mes: "2026-08-01", valor: 18_500, itens: [{ descricao: "Entrada", valor: 18_500 }] },
  {
    mes: "2026-09-01",
    valor: 21_000,
    itens: [
      { descricao: "Salário", valor: 12_000 },
      { descricao: "Freelas", valor: 9_000 },
    ],
  },
];

describe("entrada do mês em linhas", () => {
  it("soma as linhas", () => {
    expect(somaItens(incomes[1].itens)).toBe(21_000);
    expect(somaItens([])).toBe(0);
  });

  it("usa as linhas do próprio mês", () => {
    expect(itensDoMes(incomes, "2026-08-01")).toEqual([{ descricao: "Entrada", valor: 18_500 }]);
  });

  it("mês sem registro repete o último salvo antes dele", () => {
    expect(itensDoMes(incomes, "2026-10-01").map((i) => i.descricao)).toEqual([
      "Salário",
      "Freelas",
    ]);
    expect(itensDoMes(incomes, "2026-07-01")).toEqual([]);
  });

  it("devolve cópias, para editar sem mexer no que foi carregado", () => {
    const linhas = itensDoMes(incomes, "2026-09-01");
    linhas[0].valor = 1;
    expect(incomes[1].itens[0].valor).toBe(12_000);
  });
});
