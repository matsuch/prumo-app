import { describe, it, expect } from "vitest";
import { buildMonthSummary, nomeDoMes, type MonthSummaryInput } from "../monthSummary";
import type { StoredAccount, StoredBill, StoredTransaction } from "@/lib/supabase/pluggy";

function card(externalId: string, over: Partial<StoredAccount> = {}): StoredAccount {
  return {
    externalId,
    itemId: "item1",
    tipo: "CREDIT",
    nome: `Cartão ${externalId}`,
    saldo: 0,
    limiteDisponivel: null,
    limiteTotal: null,
    vencimento: null,
    brand: null,
    ...over,
  };
}
function bill(accountId: string, dueDate: string, closingDate: string, total: number): StoredBill {
  return {
    externalId: `${accountId}-${dueDate}`,
    itemId: "item1",
    accountId,
    dueDate,
    closingDate,
    totalAmount: total,
    minimumPayment: null,
  };
}
function tx(
  accountId: string,
  data: string,
  valor: number,
  over: Partial<StoredTransaction> = {},
): StoredTransaction {
  return {
    externalId: `${accountId}-${data}-${valor}-${over.descricao ?? ""}`,
    itemId: "item1",
    accountId,
    descricao: "compra",
    categoria: null,
    estabelecimento: null,
    valor,
    data,
    tipo: null,
    parcela: null,
    totalParcelas: null,
    ...over,
  };
}

// Cenário base: um cartão com faturas fechadas em jul e ago; o ciclo ABERTO fecha
// em 03/09 e vence em 10/09 → o mês de referência é setembro (M+1 de agosto).
const CARD = card("A");
const BILLS = [
  bill("A", "2026-07-10", "2026-07-03", 1000),
  bill("A", "2026-08-10", "2026-08-03", 1200),
];
const TXS = [
  tx("A", "2026-08-05", 300, { categoria: "Mercado", estabelecimento: "Hortifruti" }),
  tx("A", "2026-08-20", 200, { categoria: "Mercado", estabelecimento: "Padaria" }),
  tx("A", "2026-08-28", 100, { categoria: "Transporte", estabelecimento: "Uber" }),
  // Ciclo anterior (cobrado na fatura de agosto): não entra no ciclo aberto.
  tx("A", "2026-07-15", 999, { categoria: "Lazer" }),
  // Pagamento da fatura (valor negativo): nunca conta como gasto.
  tx("A", "2026-08-11", -1200, { descricao: "pagamento" }),
];

function input(over: Partial<MonthSummaryInput> = {}): MonthSummaryInput {
  return {
    accounts: [CARD],
    bills: BILLS,
    transactions: TXS,
    expenses: [
      { id: "1", mes: "2026-09-01", nome: "Aluguel", valor: 2000, pago: 2000 },
      { id: "2", mes: "2026-09-01", nome: "Luz", valor: 300, pago: 100 },
    ],
    incomes: [{ mes: "2026-09-01", valor: 10000, itens: [] }],
    monthlyGoals: [{ mes: "2026-09-01", valor: 1500 }],
    ...over,
  };
}

describe("buildMonthSummary", () => {
  it("ancora o mês de referência no vencimento da fatura aberta", () => {
    const s = buildMonthSummary(input());
    expect(s.mes).toBe("2026-09-01");
    expect(s.proximoVencimento).toBe("2026-09-10");
  });

  it("soma os cartões pelo ciclo aberto, ignorando pagamentos e ciclos anteriores", () => {
    const s = buildMonthSummary(input());
    expect(s.somaCartoes).toBe(600);
    expect(s.lancamentos).toBe(3);
  });

  it("calcula sobra e quanto ainda pode gastar como o Dashboard", () => {
    const s = buildMonthSummary(input());
    // 10000 − 2300 (gastos fixos previstos) − 600 (fatura) = 7100
    expect(s.gastosFixos.previsto).toBe(2300);
    expect(s.sobra).toBe(7100);
    // 7100 − 1500 (meta) = 5600
    expect(s.podeGastar).toBe(5600);
    expect(s.taxaPoupanca).toBeCloseTo(0.71, 5);
    expect(s.comprometimento).toBeCloseTo(0.29, 5);
  });

  it("não inventa sobra quando a entrada não foi cadastrada", () => {
    const s = buildMonthSummary(input({ incomes: [] }));
    expect(s.entrada).toBeNull();
    expect(s.sobra).toBeNull();
    expect(s.podeGastar).toBeNull();
    expect(s.taxaPoupanca).toBeNull();
    expect(s.temDados).toBe(true);
  });

  it("agrupa categorias com a fatia de cada uma", () => {
    const s = buildMonthSummary(input());
    expect(s.categorias).toEqual([
      { nome: "Mercado", total: 500, qtd: 2, share: 500 / 600 },
      { nome: "Transporte", total: 100, qtd: 1, share: 100 / 600 },
    ]);
  });

  it("lista as compras mais recentes de todos os cartões juntos, sem pagamentos", () => {
    const s = buildMonthSummary(
      input({
        accounts: [CARD, card("B")],
        transactions: [
          ...TXS,
          tx("B", "2026-08-30", 45, { estabelecimento: "Farmácia" }),
          tx("B", "2026-08-21", 1200, { estabelecimento: "Loja", parcela: 2, totalParcelas: 6 }),
        ],
      }),
    );
    expect(s.ultimosGastos.map((g) => [g.data, g.descricao, g.cartaoId])).toEqual([
      ["2026-08-30", "Farmácia", "B"],
      ["2026-08-28", "Uber", "A"],
      ["2026-08-21", "Loja 2/6", "B"],
      ["2026-08-20", "Padaria", "A"],
      ["2026-08-05", "Hortifruti", "A"],
      ["2026-07-15", "compra", "A"],
    ]);
  });

  it("corta os últimos gastos em dez", () => {
    const muitas = Array.from({ length: 14 }, (_, i) =>
      tx("A", `2026-08-${String(i + 10).padStart(2, "0")}`, 10 + i),
    );
    const s = buildMonthSummary(input({ transactions: muitas }));
    expect(s.ultimosGastos).toHaveLength(10);
    expect(s.ultimosGastos[0].data).toBe("2026-08-23");
  });

  it("reporta pago/pendente por item e o uso do limite do cartão", () => {
    const s = buildMonthSummary(
      input({ accounts: [card("A", { limiteTotal: 3000 })] }),
    );
    expect(s.gastosFixos.pago).toBe(2100);
    expect(s.gastosFixos.pendente).toBe(200);
    expect(s.gastosFixos.itens.map((i) => i.status)).toEqual(["pago", "parcial"]);
    expect(s.cartoes[0].usoLimite).toBeCloseTo(600 / 3000, 5);
  });

  it("zera o pago quando a lista de gastos é herdada do mês anterior", () => {
    const s = buildMonthSummary(
      input({
        expenses: [{ id: "1", mes: "2026-08-01", nome: "Aluguel", valor: 2000, pago: 2000 }],
      }),
    );
    expect(s.gastosFixos.herdado).toBe(true);
    expect(s.gastosFixos.pago).toBe(0);
    expect(s.gastosFixos.pendente).toBe(2000);
  });

  it("não conta em dobro o cartão conectado por dois itens Pluggy", () => {
    const duplicado = { ...CARD, itemId: "item2" };
    const s = buildMonthSummary(
      input({
        accounts: [CARD, duplicado],
        bills: [...BILLS, ...BILLS.map((b) => ({ ...b, itemId: "item2" }))],
      }),
    );
    expect(s.somaCartoes).toBe(600);
    expect(s.cartoes).toHaveLength(1);
  });

  it("cai no mês corrente e marca ausência de dados sem cartão nem cadastro", () => {
    const s = buildMonthSummary({
      accounts: [],
      bills: [],
      transactions: [],
      expenses: [],
      incomes: [],
      monthlyGoals: [],
      hoje: "2026-09-22",
    });
    expect(s.mes).toBe("2026-09-01");
    expect(s.somaCartoes).toBe(0);
    expect(s.temDados).toBe(false);
  });
});

describe("nomeDoMes", () => {
  it("escreve o mês por extenso em pt-BR", () => {
    expect(nomeDoMes("2026-09-01")).toBe("setembro de 2026");
    expect(nomeDoMes("2026-03-01")).toBe("março de 2026");
  });
});
