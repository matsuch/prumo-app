// Resumo mensal de cartões + fluxo — lógica PURA (dados → números), compartilhada
// pelo e-mail diário (cron `/api/cron/cartoes/resumo`) e testável sem montar UI.
//
// Espelha o card "Fluxo do mês" do Dashboard: o mês de referência acompanha o
// VENCIMENTO da fatura aberta (em geral M+1 — em setembro, a fatura aberta vence
// em outubro), e não o mês do calendário. Assim o e-mail e a tela contam a mesma
// história; divergir aqui seria pior do que não mandar e-mail nenhum.
//
// A "soma dos cartões" é sempre o ciclo ABERTO (Σ faturaAtual por cartão) — o
// mesmo número que aparece no KPI e na tabela por cartão do e-mail, para que a
// linha de cima feche com o detalhamento de baixo.

import {
  dedupeAccounts,
  dedupeBills,
  dedupeTransactions,
  faturaAtual,
  porCategoria,
  totalGasto,
  transacoesFaturaAtual,
  type Lancamento,
} from "./cards";
import {
  effectiveExpenses,
  expenseStatus,
  expenseSummaryForMonth,
  type ExpenseRow,
  type ExpenseStatus,
} from "@/lib/supabase/expenses";
import { entradaDoMes, mesRef, type MonthlyIncome } from "@/lib/supabase/income";
import { metaDoMes, type MonthlyGoal } from "@/lib/supabase/goal";
import type { StoredAccount, StoredBill, StoredTransaction } from "@/lib/supabase/pluggy";

export interface MonthSummaryInput {
  accounts: StoredAccount[];
  bills: StoredBill[];
  transactions: StoredTransaction[];
  expenses: ExpenseRow[];
  incomes: MonthlyIncome[];
  monthlyGoals: MonthlyGoal[];
  /** Data de referência (ISO yyyy-mm-dd). Só usada quando não há cartão. */
  hoje?: string;
}

export interface CartaoSummary {
  externalId: string;
  nome: string;
  brand: string | null;
  fatura: number;
  vencimento: string | null;
  fechamento: string | null;
  /** true = sem transações sincronizadas; o valor caiu no saldo do Pluggy. */
  estimadaPorSaldo: boolean;
  /** Uso do limite (0..1), quando o Pluggy informa o limite total. */
  usoLimite: number | null;
}

export interface CategoriaSummary {
  nome: string;
  total: number;
  qtd: number;
  /** Fatia do total gasto no ciclo (0..1). */
  share: number;
}

export interface GastoRecente {
  /** Data da compra (ISO yyyy-mm-dd). */
  data: string;
  descricao: string;
  valor: number;
  /** externalId do cartão em que caiu. */
  cartaoId: string;
}

export interface GastoFixoSummary {
  nome: string;
  previsto: number;
  pago: number;
  pendente: number;
  status: ExpenseStatus;
}

export interface MonthSummary {
  /** Mês de referência (ISO yyyy-mm-01) — o do vencimento da fatura aberta. */
  mes: string;
  /** Soma das faturas do ciclo ABERTO de todos os cartões. */
  somaCartoes: number;
  cartoes: CartaoSummary[];
  gastosFixos: {
    previsto: number;
    pago: number;
    pendente: number;
    /** true = lista herdada do mês anterior (o mês de referência não tem a sua). */
    herdado: boolean;
    itens: GastoFixoSummary[];
  };
  entrada: number | null;
  meta: number;
  /** entrada − gastos fixos − fatura. `null` sem entrada cadastrada. */
  sobra: number | null;
  /** Quanto ainda pode gastar: sobra − meta. `null` sem entrada cadastrada. */
  podeGastar: number | null;
  taxaPoupanca: number | null;
  comprometimento: number | null;
  categorias: CategoriaSummary[];
  /** As compras mais recentes de todos os cartões juntos, da mais nova para a mais antiga. */
  ultimosGastos: GastoRecente[];
  /** Lançamentos do ciclo aberto (todos os cartões). */
  lancamentos: number;
  /** Vencimento mais próximo entre os cartões (ISO yyyy-mm-dd). */
  proximoVencimento: string | null;
  /** false = nada a contar (sem cartão, sem gasto fixo e sem entrada). */
  temDados: boolean;
}

/** Quantas compras recentes o resumo carrega. */
const ULTIMOS_GASTOS = 10;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "setembro de 2026" a partir de um mês ISO yyyy-mm-01. */
export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${ano}`;
}

/** "10/09" a partir de uma data ISO yyyy-mm-dd. */
export function diaMes(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Nome da loja (ou a descrição do Pluggy), com a parcela quando for parcelado. */
function descricaoGasto(t: StoredTransaction): string {
  const base = (t.estabelecimento ?? t.descricao ?? "—").trim();
  const total = t.totalParcelas ?? 1;
  if (total <= 1 || /\d+\/\d+$/.test(base)) return base;
  return `${base} ${t.parcela ?? 1}/${total}`;
}

export function buildMonthSummary(input: MonthSummaryInput): MonthSummary {
  const { expenses, incomes, monthlyGoals, hoje } = input;

  // Dedupe: o mesmo cartão pode vir de mais de um item Pluggy (conta conectada
  // duas vezes) — sem isso a fatura conta em dobro.
  const cartoes = dedupeAccounts(input.accounts).filter((a) => a.tipo === "CREDIT");
  const bills = dedupeBills(input.bills);
  const txs = dedupeTransactions(input.transactions);

  const resumoCartoes: CartaoSummary[] = [];
  const lancamentos: Lancamento[] = [];
  let somaCartoes = 0;

  for (const card of cartoes) {
    const f = faturaAtual(card, bills, txs);
    somaCartoes += f.valor;
    resumoCartoes.push({
      externalId: card.externalId,
      nome: card.nome,
      brand: card.brand,
      fatura: f.valor,
      vencimento: f.vencimento,
      fechamento: f.fechamento,
      estimadaPorSaldo: f.estimadaPorSaldo,
      usoLimite:
        card.limiteTotal != null && card.limiteTotal > 0
          ? Math.min(f.valor / card.limiteTotal, 1)
          : null,
    });
    lancamentos.push(...transacoesFaturaAtual(card, bills, txs));
  }

  resumoCartoes.sort((a, b) => b.fatura - a.fatura);

  const proximoVencimento =
    resumoCartoes
      .map((c) => c.vencimento)
      .filter((v): v is string => v != null)
      .sort()[0] ?? null;

  // Âncora do período: o mês em que a fatura aberta vence. Sem cartão, o mês atual.
  const mes = proximoVencimento ? mesRef(proximoVencimento) : mesRef(hoje);

  const resumoGastos = expenseSummaryForMonth(expenses, mes);
  const itensGastos = effectiveExpenses(expenses, mes);
  // Mês herdado (carry-over) começa sem pagamentos: o "pago" do mês anterior não vale.
  const herdado = itensGastos.length > 0 && itensGastos[0].mes !== mes;

  const entrada = entradaDoMes(incomes, mes);
  const meta = metaDoMes(monthlyGoals, mes);
  const sobra = entrada == null ? null : entrada - resumoGastos.previsto - somaCartoes;
  const podeGastar = sobra == null ? null : sobra - meta;
  const temEntrada = entrada != null && entrada > 0;

  const total = totalGasto(lancamentos);
  const categorias: CategoriaSummary[] = porCategoria(lancamentos).map((c) => ({
    nome: c.chave,
    total: c.total,
    qtd: c.qtd,
    share: total > 0 ? c.total / total : 0,
  }));
  // Compras reais (sem parcela projetada) de qualquer cartão, misturadas por data.
  const idsCartoes = new Set(cartoes.map((c) => c.externalId));
  const ultimosGastos: GastoRecente[] = txs
    .filter((t) => idsCartoes.has(t.accountId) && t.valor > 0 && t.data != null)
    .sort((a, b) =>
      a.data! === b.data! ? a.externalId.localeCompare(b.externalId) : a.data! < b.data! ? 1 : -1,
    )
    .slice(0, ULTIMOS_GASTOS)
    .map((t) => ({
      data: t.data!.slice(0, 10),
      descricao: descricaoGasto(t),
      valor: t.valor,
      cartaoId: t.accountId,
    }));

  return {
    mes,
    somaCartoes,
    cartoes: resumoCartoes,
    gastosFixos: {
      previsto: resumoGastos.previsto,
      pago: resumoGastos.pago,
      pendente: resumoGastos.pendente,
      herdado,
      itens: itensGastos.map((e) => {
        const pago = herdado ? 0 : Math.max(e.pago, 0);
        return {
          nome: e.nome,
          previsto: e.valor,
          pago,
          pendente: Math.max(e.valor - pago, 0),
          status: expenseStatus(e.valor, pago),
        };
      }),
    },
    entrada,
    meta,
    sobra,
    podeGastar,
    taxaPoupanca: temEntrada && sobra != null ? sobra / entrada : null,
    comprometimento: temEntrada ? (resumoGastos.previsto + somaCartoes) / entrada : null,
    categorias,
    ultimosGastos,
    lancamentos: lancamentos.length,
    proximoVencimento,
    temDados: cartoes.length > 0 || itensGastos.length > 0 || entrada != null,
  };
}
