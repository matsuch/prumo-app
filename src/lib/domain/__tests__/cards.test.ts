import { describe, it, expect } from "vitest";
import { faturaAtual, faturaDoMes, transacoesFaturaAtual } from "../cards";
import type { StoredAccount, StoredBill, StoredTransaction } from "@/lib/supabase/pluggy";

function card(externalId: string): StoredAccount {
  return {
    externalId,
    itemId: "item1",
    tipo: "CREDIT",
    nome: "Cartão",
    saldo: 0,
    limiteDisponivel: null,
    limiteTotal: null,
    vencimento: null,
    brand: null,
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
function tx(accountId: string, data: string, valor: number): StoredTransaction {
  return {
    externalId: `${accountId}-${data}-${valor}`,
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
  };
}

// Cenário: cartão com 2 faturas fechadas (jul, ago). O ciclo ABERTO fecha em set
// (vencimento 10/09), com uma compra de 300 no ciclo.
const cartoes = [card("A")];
const bills: StoredBill[] = [
  bill("A", "2026-07-10", "2026-07-03", 1000),
  bill("A", "2026-08-10", "2026-08-03", 1200),
];
const txs: StoredTransaction[] = [tx("A", "2026-08-15", 300)];

describe("faturaDoMes", () => {
  it("mês do ciclo aberto → fatura estimada pelas transações", () => {
    const f = faturaDoMes(cartoes, bills, txs, "2026-09-01");
    expect(f.valor).toBe(300);
    expect(f.estimada).toBe(true);
    expect(f.fechada).toBe(false);
  });

  it("mês passado → valor real da fatura FECHADA daquele vencimento", () => {
    const ago = faturaDoMes(cartoes, bills, txs, "2026-08-01");
    expect(ago.valor).toBe(1200);
    expect(ago.fechada).toBe(true);
    expect(ago.estimada).toBe(false);

    const jul = faturaDoMes(cartoes, bills, txs, "2026-07-01");
    expect(jul.valor).toBe(1000);
  });

  it("mês futuro sem nada comprometido → valor null", () => {
    const f = faturaDoMes(cartoes, bills, txs, "2026-12-01");
    expect(f.valor).toBeNull();
    expect(f.fechada).toBe(false);
    expect(f.estimada).toBe(false);
    expect(f.parcial).toBe(false);
  });

  it("mês futuro com parcelas já lançadas → estimativa parcial", () => {
    // Ciclo aberto vence em set (10/09); out é o mês futuro seguinte, cuja janela
    // projetada é [03/09, 03/10). Uma parcela lançada em 20/09 cai nesse ciclo.
    const comParcela = [...txs, tx("A", "2026-09-20", 250)];
    const out = faturaDoMes(cartoes, bills, comParcela, "2026-10-01");
    expect(out.valor).toBe(250);
    expect(out.parcial).toBe(true);
    expect(out.fechada).toBe(false);
    expect(out.estimada).toBe(false);
  });

  it("fatura fechada tem prioridade sobre projeção no mesmo mês", () => {
    // Se o Pluggy fecha a fatura de set, o valor REAL assume no lugar do estimado.
    const comFechadaSet = [...bills, bill("A", "2026-09-10", "2026-09-03", 999)];
    const set = faturaDoMes(cartoes, comFechadaSet, txs, "2026-09-01");
    expect(set.valor).toBe(999);
    expect(set.fechada).toBe(true);
    expect(set.estimada).toBe(false);
    expect(set.parcial).toBe(false);
  });

  it("soma múltiplos cartões no mesmo mês fechado", () => {
    const dois = [card("A"), card("B")];
    const maisBills = [...bills, bill("B", "2026-08-12", "2026-08-05", 500)];
    const f = faturaDoMes(dois, maisBills, txs, "2026-08-01");
    expect(f.valor).toBe(1700); // 1200 (A) + 500 (B)
  });

  it("sem cartões → null", () => {
    expect(faturaDoMes([], bills, txs, "2026-08-01").valor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fatura ABERTA: reconstrução das parcelas do ciclo.
//
// Cenário fictício (cartão fecha dia 02): fatura fechada
// em 02/09 (venc. 09/09) → ciclo aberto = 02/09 a 02/10, fecha em 02/10.
// ---------------------------------------------------------------------------
function parcela(
  accountId: string,
  data: string,
  valor: number,
  descricao: string,
  n: number,
  total: number,
): StoredTransaction {
  return {
    ...tx(accountId, data, valor),
    externalId: `${accountId}-${descricao}-${n}`,
    descricao: `${descricao} ${n}/${total}`,
    parcela: n,
    totalParcelas: total,
  };
}

const billsC: StoredBill[] = [
  bill("C", "2026-08-10", "2026-08-02", 4250),
  bill("C", "2026-09-09", "2026-09-02", 3180.4),
];

describe("faturaAtual — parcelas do ciclo aberto", () => {
  it("reconstrói a parcela que o Pluggy não entregou na fatura aberta", () => {
    // Loja de Casa 10x: o Pluggy tem a 4ª (faturada, datada no início do ciclo
    // anterior) e a 6ª (futura, datada no dia da compra) — a 5ª, que é a deste
    // ciclo, simplesmente não existe na base.
    const txs = [
      parcela("C", "2026-08-02", 120.5, "Loja de Casa", 4, 10),
      parcela("C", "2026-10-05", 120.5, "Loja de Casa", 6, 10),
    ];
    const lanc = transacoesFaturaAtual(card("C"), billsC, txs);
    expect(lanc).toHaveLength(1);
    expect(lanc[0].parcela).toBe(5);
    expect(lanc[0].valor).toBe(120.5);
    expect(lanc[0].projetada).toBe(true);
    expect(faturaAtual(card("C"), billsC, txs).valor).toBe(120.5);
  });

  it("usa a parcela real quando o Pluggy a entregou, sem duplicar", () => {
    const txs = [
      parcela("C", "2026-08-02", 150.25, "Loja de Móveis", 4, 6),
      parcela("C", "2026-09-14", 150.25, "Loja de Móveis", 5, 6),
      parcela("C", "2026-10-14", 150.25, "Loja de Móveis", 6, 6),
    ];
    const lanc = transacoesFaturaAtual(card("C"), billsC, txs);
    expect(lanc).toHaveLength(1);
    expect(lanc[0].parcela).toBe(5);
    expect(lanc[0].projetada).toBeUndefined();
  });

  it("não empurra para a fatura aberta a parcela que é da fatura seguinte", () => {
    // Compra parcelada feita NESTE ciclo: só a 1ª parcela entra. A 2ª vem datada
    // em 01/10 (dia da compra), antes do fechamento de 02/10 — mas é da próxima.
    const txs = [
      parcela("C", "2026-09-02", 230.5, "Marketplace", 1, 2),
      parcela("C", "2026-10-01", 230.49, "Marketplace", 2, 2),
    ];
    const lanc = transacoesFaturaAtual(card("C"), billsC, txs);
    expect(lanc).toHaveLength(1);
    expect(lanc[0].parcela).toBe(1);
    expect(faturaAtual(card("C"), billsC, txs).valor).toBe(230.5);
  });

  it("ignora parcelamento que terminou na fatura anterior", () => {
    const txs = [parcela("C", "2026-08-02", 96.06, "Petz", 2, 2)];
    expect(transacoesFaturaAtual(card("C"), billsC, txs)).toHaveLength(0);
  });

  it("soma compras à vista do ciclo e ignora as de fora", () => {
    const txs = [
      tx("C", "2026-09-05", 500), // dentro
      tx("C", "2026-09-01", 99), // fatura anterior (fechou em 02/09)
      tx("C", "2026-10-03", 77), // próxima fatura
    ];
    expect(faturaAtual(card("C"), billsC, txs).valor).toBe(500);
  });

  it("combina à vista, parcela reconstruída e compra parcelada nova", () => {
    const txs = [
      tx("C", "2026-09-05", 500),
      parcela("C", "2026-08-02", 122.4, "Renner", 2, 4), // → projeta a 3ª
      parcela("C", "2026-10-05", 122.4, "Renner", 4, 4),
      parcela("C", "2026-09-05", 380, "Vivara Jog", 1, 10), // compra nova do ciclo
      parcela("C", "2026-10-04", 380, "Vivara Jog", 2, 10),
    ];
    expect(faturaAtual(card("C"), billsC, txs).valor).toBeCloseTo(1002.4, 2);
  });

  it("sem fatura fechada conhecida, cai na filtragem por data", () => {
    const semBills: StoredBill[] = [];
    const txs = [tx("C", "2026-09-05", 500), tx("C", "2026-10-03", 77)];
    expect(faturaAtual(card("C"), semBills, txs).valor).toBe(577);
  });
});
