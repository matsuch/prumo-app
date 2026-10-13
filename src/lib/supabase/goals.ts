import { createClient, type Supa } from "./client";
import { ensureSession } from "./carteira";

export interface Goal {
  id: string;
  nome: string;
  valorAlvo: number;
  dataAlvo: string; // ISO yyyy-mm-dd
  aporteMensal: number;
}

function map(r: {
  id: string;
  nome: string;
  valor_alvo: number;
  data_alvo: string;
  aporte_mensal: number;
}): Goal {
  return {
    id: r.id,
    nome: r.nome,
    valorAlvo: r.valor_alvo,
    dataAlvo: r.data_alvo,
    aporteMensal: r.aporte_mensal,
  };
}

export async function getGoals(db?: Supa): Promise<Goal[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("data_alvo", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(map);
}

export async function addGoal(goal: Omit<Goal, "id">): Promise<Goal> {
  await ensureSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      nome: goal.nome,
      valor_alvo: goal.valorAlvo,
      data_alvo: goal.dataAlvo,
      aporte_mensal: goal.aporteMensal,
    })
    .select()
    .single();
  if (error) throw error;
  return map(data);
}

export async function updateGoalAporte(id: string, aporteMensal: number): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase
    .from("goals")
    .update({ aporte_mensal: aporteMensal })
    .eq("id", id);
  if (error) throw error;
}

export async function removeGoal(id: string): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
