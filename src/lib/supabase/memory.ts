// Memória do Copiloto sobre o usuário (client-side, protegida por RLS).
// Fatos duráveis que dão ao copiloto continuidade entre conversas: perfil de
// risco, objetivos, momentos de vida, preferências, decisões e comportamento.
// O usuário vê e edita tudo aqui — memória inferida pela IA precisa ser
// confirmável e removível.

import { createClient } from "./client";
import { ensureSession } from "./carteira";

export type MemoriaCategoria =
  | "perfil"
  | "objetivo"
  | "evento_de_vida"
  | "preferencia"
  | "decisao"
  | "comportamento"
  | "outro";

export type MemoriaOrigem = "usuario" | "copiloto";

export interface UserMemory {
  id: string;
  categoria: MemoriaCategoria;
  conteudo: string;
  origem: MemoriaOrigem;
  createdAt: string;
  updatedAt: string;
}

// Rótulo e ordem de exibição de cada categoria (usado na UI e no contexto da IA).
export const CATEGORIA_META: Record<MemoriaCategoria, { label: string; ordem: number }> = {
  perfil: { label: "Perfil de investidor", ordem: 0 },
  objetivo: { label: "Objetivos", ordem: 1 },
  evento_de_vida: { label: "Momentos de vida", ordem: 2 },
  preferencia: { label: "Preferências", ordem: 3 },
  decisao: { label: "Decisões", ordem: 4 },
  comportamento: { label: "Comportamento", ordem: 5 },
  outro: { label: "Outros", ordem: 6 },
};

export function isMemoriaCategoria(v: string): v is MemoriaCategoria {
  return v in CATEGORIA_META;
}

interface Row {
  id: string;
  categoria: string;
  conteudo: string;
  origem: string;
  created_at: string;
  updated_at: string;
}

function fromRow(r: Row): UserMemory {
  return {
    id: r.id,
    categoria: isMemoriaCategoria(r.categoria) ? r.categoria : "outro",
    conteudo: r.conteudo,
    origem: r.origem === "usuario" ? "usuario" : "copiloto",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getMemories(): Promise<UserMemory[]> {
  await ensureSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_memory")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

export async function addMemory(
  categoria: MemoriaCategoria,
  conteudo: string,
  origem: MemoriaOrigem = "usuario",
): Promise<UserMemory> {
  await ensureSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_memory")
    .insert({ categoria, conteudo: conteudo.trim(), origem })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateMemory(
  id: string,
  patch: { categoria?: MemoriaCategoria; conteudo?: string },
): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const update: { updated_at: string; categoria?: MemoriaCategoria; conteudo?: string } = {
    updated_at: new Date().toISOString(),
  };
  if (patch.categoria) update.categoria = patch.categoria;
  if (patch.conteudo != null) update.conteudo = patch.conteudo.trim();
  const { error } = await supabase.from("user_memory").update(update).eq("id", id);
  if (error) throw error;
}

export async function removeMemory(id: string): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase.from("user_memory").delete().eq("id", id);
  if (error) throw error;
}
