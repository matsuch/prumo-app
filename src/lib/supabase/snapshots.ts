// Snapshots do patrimônio ao longo do tempo (um por dia, RLS por usuário).

import { createClient } from "./client";
import { ensureSession } from "./carteira";

export interface Snapshot {
  id: string;
  data: string; // ISO yyyy-mm-dd
  patrimonio: number;
  investido: number;
  porClasse: Record<string, number> | null;
}

export async function getSnapshots(): Promise<Snapshot[]> {
  await ensureSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("snapshots")
    .select("*")
    .order("data", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    data: r.data,
    patrimonio: r.patrimonio,
    investido: r.investido,
    porClasse: (r.por_classe as Record<string, number> | null) ?? null,
  }));
}

/** Salva (ou atualiza) o snapshot de uma data — um por dia. */
export async function saveSnapshot(s: {
  data: string;
  patrimonio: number;
  investido: number;
  porClasse?: Record<string, number>;
}): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase.from("snapshots").upsert(
    {
      data: s.data,
      patrimonio: s.patrimonio,
      investido: s.investido,
      por_classe: s.porClasse ?? null,
    },
    { onConflict: "user_id,data" },
  );
  if (error) throw error;
}

export async function removeSnapshot(id: string): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase.from("snapshots").delete().eq("id", id);
  if (error) throw error;
}
