// Gastos fixos mensais (luz, condomínio, etc.). São por MÊS: cada mês tem sua
// própria lista, e um mês sem lista própria herda o último mês salvo (carry-over),
// já que os valores variam mas os itens costumam se repetir.
//
// Cada item tem um valor PREVISTO (o cadastrado) e um valor PAGO (acumulado no
// período). O pendente é derivado: max(previsto − pago, 0). Gastos consumidos ao
// longo do mês (diarista, serviços semanais) permitem registrar o pago aos poucos.
import { createClient, type Supa } from "./client";
import { ensureSession } from "./carteira";

export interface ExpenseRow {
  id: string;
  mes: string; // ISO yyyy-mm-01
  nome: string;
  valor: number; // previsto
  pago: number; // acumulado pago no período
}

export interface ExpenseItem {
  nome: string;
  valor: number; // previsto
  pago: number; // acumulado pago
}

export type ExpenseStatus = "pendente" | "parcial" | "pago";

export async function getAllExpenses(db?: Supa): Promise<ExpenseRow[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const { data, error } = await supabase
    .from("fixed_expenses")
    .select("id, mes, nome, valor, pago")
    .order("valor", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    mes: r.mes,
    nome: r.nome,
    valor: r.valor,
    pago: r.pago ?? 0,
  }));
}

// Substitui a lista de um mês (apaga o mês e insere os itens informados).
export async function saveMonthExpenses(mes: string, items: ExpenseItem[]): Promise<void> {
  await ensureSession();
  const supabase = createClient();

  const cleared = await supabase.from("fixed_expenses").delete().eq("mes", mes);
  if (cleared.error) throw cleared.error;

  const rows = items
    .filter((i) => i.nome.trim() !== "" || i.valor > 0 || i.pago > 0)
    .map((i) => ({
      mes,
      nome: i.nome.trim() || "Gasto",
      valor: i.valor,
      pago: Math.max(i.pago, 0),
    }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("fixed_expenses").insert(rows);
  if (error) throw error;
}

// Lista efetiva de um mês: a do próprio mês, ou (se vazia) a do mês salvo mais
// recente <= mes (carry-over). Sem histórico, lista vazia.
export function effectiveExpenses(all: ExpenseRow[], mes: string): ExpenseRow[] {
  const doMes = all.filter((e) => e.mes === mes);
  if (doMes.length) return doMes;
  const anteriores = all.filter((e) => e.mes < mes);
  if (anteriores.length === 0) return [];
  const ultimoMes = anteriores.reduce((m, e) => (e.mes > m ? e.mes : m), anteriores[0].mes);
  return anteriores.filter((e) => e.mes === ultimoMes);
}

// true quando a lista efetiva veio de carry-over (o mês pedido não tem lista própria).
// Nesse caso o "pago" do mês anterior NÃO conta: o mês novo começa sem pagamentos.
function isCarried(eff: ExpenseRow[], mes: string): boolean {
  return eff.length > 0 && eff[0].mes !== mes;
}

export function totalExpensesForMonth(all: ExpenseRow[], mes: string): number {
  return effectiveExpenses(all, mes).reduce((s, e) => s + e.valor, 0);
}

export interface MonthExpenseSummary {
  previsto: number;
  pago: number;
  pendente: number;
}

// Resumo previsto/pago/pendente de um mês, respeitando o carry-over (mês herdado
// tem pago = 0). Pendente é somado por item com piso zero: Σ max(previsto − pago, 0).
export function expenseSummaryForMonth(all: ExpenseRow[], mes: string): MonthExpenseSummary {
  const eff = effectiveExpenses(all, mes);
  const carried = isCarried(eff, mes);
  let previsto = 0;
  let pago = 0;
  let pendente = 0;
  for (const e of eff) {
    const p = carried ? 0 : Math.max(e.pago, 0);
    previsto += e.valor;
    pago += p;
    pendente += Math.max(e.valor - p, 0);
  }
  return { previsto, pago, pendente };
}

// Status de pagamento de um item, derivado de previsto × pago.
export function expenseStatus(previsto: number, pago: number): ExpenseStatus {
  if (pago <= 0) return "pendente";
  if (pago >= previsto) return "pago";
  return "parcial";
}
