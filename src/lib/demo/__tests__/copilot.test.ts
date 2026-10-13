import { describe, expect, it } from "vitest";
import { answerDemoQuestion, classifyQuestion, type DemoCopilotData } from "../copilot";
import { buildSeed } from "../seed";
import { DEMO_USER } from "../fakeSupabase";

const TODAY = new Date("2026-10-13T12:00:00Z");

// Mesmo mapeamento dos leitores de src/lib/supabase (linhas → domínio).
function dataFromSeed(): DemoCopilotData {
  const s = buildSeed(DEMO_USER.id, TODAY) as Record<string, Record<string, never>[]>;
  return {
    today: "2026-10-13",
    fixed: s.fixed_income.map((r) => ({
      id: r.id, emissor: r.emissor, indexador: r.indexador, taxa: r.taxa,
      valorAplicado: r.valor_aplicado, dataAplicacao: r.data_aplicacao,
      vencimento: r.vencimento, isento: r.isento,
    })),
    stocks: s.stocks.map((r) => ({
      id: r.id, ticker: r.ticker, quantidade: r.quantidade,
      precoCompra: r.preco_compra, dataCompra: r.data_compra,
    })),
    fixedValues: {},
    stockValues: {},
    pluggy: s.pluggy_positions.map((r) => ({
      externalId: r.external_id, itemId: r.item_id, categoria: r.categoria, nome: r.nome,
      valorAtual: r.valor_atual, valorInvestido: r.valor_investido, rendimento: r.rendimento,
    })),
    accounts: s.pluggy_accounts.map((r) => ({
      externalId: r.external_id, itemId: r.item_id, tipo: r.tipo, nome: r.nome, saldo: r.saldo,
      limiteDisponivel: r.limite_disponivel, limiteTotal: r.limite_total,
      vencimento: r.vencimento, brand: r.brand,
    })),
    bills: s.pluggy_bills.map((r) => ({
      externalId: r.external_id, itemId: r.item_id, accountId: r.account_id, dueDate: r.due_date,
      closingDate: r.closing_date, totalAmount: r.total_amount, minimumPayment: r.minimum_payment,
    })),
    transactions: s.pluggy_transactions.map((r) => ({
      externalId: r.external_id, itemId: r.item_id, accountId: r.account_id, descricao: r.descricao,
      categoria: r.categoria, estabelecimento: r.estabelecimento, valor: r.valor, data: r.data,
      tipo: r.tipo, parcela: r.parcela, totalParcelas: r.total_parcelas,
    })),
    aporteMensal: 4000,
  };
}

describe("Copiloto do modo demo", () => {
  it("reconhece as quatro perguntas sugeridas", () => {
    expect(classifyQuestion("Como está minha diversificação?")).toBe("diversificacao");
    expect(classifyQuestion("Quanto está minha fatura atual do cartão?")).toBe("fatura");
    expect(classifyQuestion("Quais meus maiores gastos no cartão?")).toBe("gastos");
    expect(classifyQuestion("Explique a projeção da minha carteira")).toBe("projecao");
    expect(classifyQuestion("Bom dia")).toBeNull();
  });

  it("responde cada pergunta com números da carteira, sem NaN", () => {
    const d = dataFromSeed();
    for (const q of ["diversificacao", "fatura", "gastos", "projecao"] as const) {
      const r = answerDemoQuestion(q, d);
      expect(r).toContain("R$");
      expect(r).not.toMatch(/NaN|undefined|Infinity/);
      expect(r).toContain("Modo demo");
    }
  });

  it("a projeção ordena os cenários e a fatura cita os dois cartões", () => {
    const d = dataFromSeed();
    expect(answerDemoQuestion("fatura", d)).toMatch(/Cartão Platinum[\s\S]*Cartão Gold|Cartão Gold[\s\S]*Cartão Platinum/);
    const proj = answerDemoQuestion("projecao", d);
    const valor = (rotulo: string) =>
      Number(proj.match(new RegExp(`${rotulo}:\\*\\* R\\$\\s?([\\d.]+)`))![1].replace(/\./g, ""));
    expect(valor("Cenário pessimista")).toBeLessThan(valor("Cenário base"));
    expect(valor("Cenário base")).toBeLessThan(valor("Cenário otimista"));
  });
});
