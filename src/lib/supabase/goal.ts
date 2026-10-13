// Meta de investimento do mês: quanto o usuário planeja guardar/investir naquele
// mês. Diferente da Entrada, a Meta NÃO tem carry-over — vale apenas para o mês
// em que foi cadastrada (meses sem cadastro ficam sem meta).
import { createClient, type Supa } from "./client";
import { ensureSession } from "./carteira";
import { mesRef } from "./income";

export interface MonthlyGoal {
  mes: string; // ISO yyyy-mm-01
  valor: number;
}

export async function getGoals(db?: Supa): Promise<MonthlyGoal[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const { data, error } = await supabase
    .from("monthly_goal")
    .select("mes, valor")
    .order("mes", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ mes: r.mes, valor: r.valor }));
}

export async function saveGoal(mes: string, valor: number): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase
    .from("monthly_goal")
    .upsert({ mes, valor, updated_at: new Date().toISOString() }, { onConflict: "user_id,mes" });
  if (error) throw error;
}

// Meta do mês informado (sem fallback para meses anteriores): retorna 0 quando o
// mês não tem meta cadastrada.
export function metaDoMes(goals: MonthlyGoal[], mes = mesRef()): number {
  return goals.find((g) => g.mes === mes)?.valor ?? 0;
}
