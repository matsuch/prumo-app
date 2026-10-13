import { describe, it, expect } from "vitest";
import {
  MERCADO_PAGO_FAIXA_120,
  normalizeAccount,
  normalizeInvestment,
  normalizeInvestments,
  posicoesDeSaldoRendendo,
} from "../normalize";

describe("normalizeInvestment", () => {
  it("mapeia renda fixa com valores marcados a mercado", () => {
    const r = normalizeInvestment(
      {
        id: "inv1",
        name: "CDB Banco X",
        type: "FIXED_INCOME",
        balance: 12000,
        amountOriginal: 10000,
        amountProfit: 2000,
      },
      0,
    );
    expect(r).toEqual({
      externalId: "inv1",
      categoria: "Renda fixa",
      nome: "CDB Banco X",
      valorAtual: 12000,
      valorInvestido: 10000,
      rendimento: 2000,
    });
  });

  it("mapeia ação/FII pelo type EQUITY", () => {
    const r = normalizeInvestment(
      { id: "p", name: "PETR4", type: "EQUITY", balance: 4000, amountProfit: 500 },
      0,
    );
    expect(r.categoria).toBe("Ações/FIIs");
    expect(r.valorInvestido).toBe(3500); // 4000 - 500
  });

  it("categoria desconhecida vira 'Outros' e gera externalId de fallback", () => {
    const r = normalizeInvestment({ name: "Algo", balance: 100 }, 3);
    expect(r.categoria).toBe("Outros");
    expect(r.externalId).toBe("Algo-3");
    // sem amountOriginal/amountProfit → investido = atual, rendimento 0
    expect(r.valorInvestido).toBe(100);
    expect(r.rendimento).toBe(0);
  });

  it("normaliza uma lista inteira", () => {
    const list = normalizeInvestments([
      { id: "a", type: "FIXED_INCOME", balance: 100 },
      { id: "b", type: "EQUITY", balance: 200 },
    ]);
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.categoria)).toEqual(["Renda fixa", "Ações/FIIs"]);
  });
});

describe("Mercado Pago: dinheiro da conta vira renda fixa", () => {
  function mp(reservado: number | null, balance = 1000) {
    return {
      id: "mp1",
      type: "BANK",
      name: "Mercado Pago (Conta Pré-paga)",
      balance,
      bankData: { automaticallyInvestedBalance: reservado },
    };
  }

  it("gera uma posição por taxa: saldo a 105% e reservado nas duas faixas", () => {
    const pos = posicoesDeSaldoRendendo([mp(10216.76, 1000)]);
    expect(pos.map((p) => [p.nome, p.valorAtual])).toEqual([
      ["Mercado Pago (Conta Pré-paga) — saldo em conta (105% do CDI)", 1000],
      ["Mercado Pago (Conta Pré-paga) — reservado (120% do CDI)", MERCADO_PAGO_FAIXA_120],
      ["Mercado Pago (Conta Pré-paga) — reservado (100% do CDI)", 5216.76],
    ]);
    expect(pos.map((p) => p.externalId)).toEqual([
      "mp1-saldo-105",
      "mp1-rendendo-120",
      "mp1-rendendo-100",
    ]);
  });

  it("o saldo em conta sai do caixa, para não contar duas vezes", () => {
    const conta = normalizeAccount(mp(10216.76, 1000), 0);
    expect(conta.saldo).toBe(0);
    // e o mesmo dinheiro aparece uma única vez, na carteira
    const naCarteira = posicoesDeSaldoRendendo([mp(10216.76, 1000)])
      .filter((p) => p.nome.includes("saldo em conta"))
      .reduce((s, p) => s + p.valorAtual, 0);
    expect(naCarteira).toBe(1000);
  });

  it("reservado abaixo do teto fica todo na faixa de 120%", () => {
    const pos = posicoesDeSaldoRendendo([mp(1200, 0)]);
    expect(pos).toHaveLength(1);
    expect(pos[0].valorAtual).toBe(1200);
    expect(pos[0].nome).toContain("120% do CDI");
  });

  it("entra como renda fixa, sem inventar rendimento", () => {
    const [p] = posicoesDeSaldoRendendo([mp(0, 300)]);
    expect(p.categoria).toBe("Renda fixa");
    // patrimônio − investido = 0: não temos custo desse dinheiro.
    expect(p.valorInvestido).toBe(p.valorAtual);
    expect(p.rendimento).toBe(0);
  });

  it("conta zerada não gera posição nenhuma", () => {
    expect(posicoesDeSaldoRendendo([mp(0, 0)])).toHaveLength(0);
    expect(posicoesDeSaldoRendendo([mp(null, 0)])).toHaveLength(0);
    expect(posicoesDeSaldoRendendo([{ id: "x", type: "BANK", name: "Mercado Pago" }])).toHaveLength(
      0,
    );
  });

  it("ignora outros bancos: o Nubank já entrega o rendendo como CDB", () => {
    const nubank = {
      id: "nu1",
      type: "BANK",
      name: "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)",
      balance: 9419.66,
      bankData: { automaticallyInvestedBalance: 8000 },
    };
    expect(posicoesDeSaldoRendendo([nubank])).toHaveLength(0);
    // e o saldo do Nubank continua no caixa, intacto
    expect(normalizeAccount(nubank, 0).saldo).toBe(9419.66);
  });

  it("ignora cartão de crédito", () => {
    const cartao = {
      id: "c1",
      type: "CREDIT",
      name: "Mercado Pago",
      balance: 500,
      bankData: { automaticallyInvestedBalance: 500 },
    };
    expect(posicoesDeSaldoRendendo([cartao])).toHaveLength(0);
    // cartão: `balance` é a fatura, não pode ser zerado
    expect(normalizeAccount(cartao, 0).saldo).toBe(500);
  });
});
