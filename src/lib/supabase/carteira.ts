// Acesso à carteira no Supabase (client-side, protegido por RLS).
// Substitui o antigo carteiraStore (localStorage).

import { createClient, type Supa } from "./client";
import type { FixedIncomePosition, Indexador } from "@/lib/domain/fixedIncome";
import type { StockPosition } from "@/lib/domain/stocks";

export interface CarteiraData {
  fixed: FixedIncomePosition[];
  stocks: StockPosition[];
}

/**
 * Garante que há uma sessão autenticada (login/senha) antes de qualquer
 * operação. O gate em `proxy.ts` já redireciona quem não está logado para
 * `/login`; aqui apenas rejeitamos sessões ausentes ou anônimas por segurança.
 */
export async function ensureSession() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    throw new Error("Você precisa estar logado para acessar sua carteira.");
  }
}

export async function getCarteira(db?: Supa): Promise<CarteiraData> {
  // `db` injetado = caminho servidor (a rota já autenticou; RLS escopa por usuário).
  // Sem `db` = caminho cliente: cria o browser client e valida a sessão.
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const [fx, st] = await Promise.all([
    supabase.from("fixed_income").select("*").order("created_at", { ascending: true }),
    supabase.from("stocks").select("*").order("created_at", { ascending: true }),
  ]);
  if (fx.error) throw fx.error;
  if (st.error) throw st.error;

  return {
    fixed: (fx.data ?? []).map((r) => ({
      id: r.id,
      emissor: r.emissor,
      indexador: r.indexador as Indexador,
      taxa: r.taxa,
      valorAplicado: r.valor_aplicado,
      dataAplicacao: r.data_aplicacao,
      vencimento: r.vencimento ?? undefined,
      isento: r.isento,
    })),
    stocks: (st.data ?? []).map((r) => ({
      id: r.id,
      ticker: r.ticker,
      quantidade: r.quantidade,
      precoCompra: r.preco_compra,
      dataCompra: r.data_compra,
    })),
  };
}

export async function addFixed(
  pos: Omit<FixedIncomePosition, "id">,
): Promise<FixedIncomePosition> {
  await ensureSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fixed_income")
    .insert({
      emissor: pos.emissor,
      indexador: pos.indexador,
      taxa: pos.taxa,
      valor_aplicado: pos.valorAplicado,
      data_aplicacao: pos.dataAplicacao,
      vencimento: pos.vencimento ?? null,
      isento: pos.isento ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    emissor: data.emissor,
    indexador: data.indexador as Indexador,
    taxa: data.taxa,
    valorAplicado: data.valor_aplicado,
    dataAplicacao: data.data_aplicacao,
    vencimento: data.vencimento ?? undefined,
    isento: data.isento,
  };
}

export async function addStock(pos: Omit<StockPosition, "id">): Promise<StockPosition> {
  await ensureSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("stocks")
    .insert({
      ticker: pos.ticker,
      quantidade: pos.quantidade,
      preco_compra: pos.precoCompra,
      data_compra: pos.dataCompra,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    ticker: data.ticker,
    quantidade: data.quantidade,
    precoCompra: data.preco_compra,
    dataCompra: data.data_compra,
  };
}

export async function removeFixed(id: string): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase.from("fixed_income").delete().eq("id", id);
  if (error) throw error;
}

export async function removeStock(id: string): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase.from("stocks").delete().eq("id", id);
  if (error) throw error;
}
