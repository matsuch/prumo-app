// Entrada do mês (salário + demais rendas), informada pelo usuário por mês.
import { createClient, type Supa } from "./client";
import { ensureSession } from "./carteira";

// Uma linha da entrada: "Salário" | 8.000,00.
export interface IncomeItem {
  descricao: string;
  valor: number;
}

export interface MonthlyIncome {
  mes: string; // ISO yyyy-mm-01
  valor: number; // total do mês = soma das linhas
  itens: IncomeItem[];
}

// Normaliza o jsonb `itens`. Registro sem linhas (anterior às linhas) ou cujas
// linhas não batem com o total (salvo por uma versão que só gravava `valor`)
// vira uma linha "Entrada" com o total: `valor` é a fonte de verdade.
function parseItens(raw: unknown, valor: number): IncomeItem[] {
  const list = Array.isArray(raw)
    ? raw
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .map((r) => ({ descricao: String(r.descricao ?? ""), valor: Number(r.valor) || 0 }))
    : [];
  if (Math.abs(somaItens(list) - valor) > 0.005) {
    return valor > 0 ? [{ descricao: "Entrada", valor }] : [];
  }
  return list;
}

export function somaItens(itens: IncomeItem[]): number {
  return itens.reduce((s, i) => s + (Number(i.valor) || 0), 0);
}

// Primeiro dia do mês (ISO) de uma data qualquer; default = hoje.
export function mesRef(dataISO?: string): string {
  const base = dataISO ? new Date(`${dataISO}T00:00:00Z`) : new Date();
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function getIncomes(db?: Supa): Promise<MonthlyIncome[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const { data, error } = await supabase
    .from("monthly_income")
    .select("mes, valor, itens")
    .order("mes", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    mes: r.mes,
    valor: Number(r.valor) || 0,
    itens: parseItens(r.itens, Number(r.valor) || 0),
  }));
}

// Salva as linhas do mês; `valor` guarda a soma, que é o que o dashboard lê.
// Linhas sem descrição e sem valor são descartadas.
export async function saveIncome(mes: string, itens: IncomeItem[]): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const limpos = itens
    .map((i) => ({ descricao: i.descricao.trim(), valor: Number(i.valor) || 0 }))
    .filter((i) => i.descricao || i.valor);
  const { error } = await supabase.from("monthly_income").upsert(
    { mes, valor: somaItens(limpos), itens: limpos, updated_at: new Date().toISOString() },
    { onConflict: "user_id,mes" },
  );
  if (error) throw error;
}

// Entrada do mês corrente, com fallback para o registro mais recente (a renda
// costuma se repetir; assim o valor "carrega" até o usuário mudar).
export function entradaDoMes(incomes: MonthlyIncome[], mes = mesRef()): number | null {
  if (incomes.length === 0) return null;
  const atual = incomes.find((i) => i.mes === mes);
  if (atual) return atual.valor;
  const anteriores = incomes.filter((i) => i.mes <= mes);
  const ref = (anteriores.length ? anteriores : incomes).at(-1);
  return ref?.valor ?? null;
}

// Linhas para editar num mês: as do próprio mês ou, se ele ainda não tem
// registro, as do último mês salvo antes dele (a renda costuma se repetir).
export function itensDoMes(incomes: MonthlyIncome[], mes: string): IncomeItem[] {
  const atual = incomes.find((i) => i.mes === mes);
  const ref = atual ?? incomes.filter((i) => i.mes < mes).at(-1);
  return ref ? ref.itens.map((i) => ({ ...i })) : [];
}
