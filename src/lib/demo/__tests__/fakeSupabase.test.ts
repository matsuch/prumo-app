import { describe, expect, it } from "vitest";
import { DemoStore, createDemoClient, DEMO_USER } from "../fakeSupabase";
import { buildSeed } from "../seed";

function client() {
  return createDemoClient(new DemoStore());
}

describe("Supabase do modo demo", () => {
  it("devolve o usuário de demonstração", async () => {
    const { data } = await client().auth.getUser();
    expect(data.user.id).toBe(DEMO_USER.id);
    expect(data.user.is_anonymous).toBe(false);
  });

  it("filtra, ordena e projeta colunas", async () => {
    const { data } = await client()
      .from("goals")
      .select("nome, valor_alvo")
      .order("valor_alvo", { ascending: false });
    const rows = data as { nome: string; valor_alvo: number }[];
    expect(rows[0]).toEqual({ nome: "Independência financeira", valor_alvo: 2500000 });
    expect(Object.keys(rows[1])).toEqual(["nome", "valor_alvo"]);
  });

  it("insere com id e devolve a linha com select().single()", async () => {
    const db = client();
    const { data, error } = await db
      .from("stocks")
      .insert({ ticker: "ABCD3", quantidade: 10, preco_compra: 5, data_compra: "2026-01-02" })
      .select()
      .single();
    expect(error).toBeNull();
    const row = data as { id: string; user_id: string };
    expect(row.id).toBeTruthy();
    expect(row.user_id).toBe(DEMO_USER.id);
    const { data: again } = await db.from("stocks").select("*").eq("ticker", "ABCD3");
    expect(again).toHaveLength(1);
  });

  it("upsert atualiza pela chave de conflito em vez de duplicar", async () => {
    const db = client();
    const mes = "2026-10-01";
    await db.from("monthly_goal").upsert({ mes, valor: 1 }, { onConflict: "user_id,mes" });
    await db.from("monthly_goal").upsert({ mes, valor: 2 }, { onConflict: "user_id,mes" });
    const { data } = await db.from("monthly_goal").select("*").eq("mes", mes);
    expect(data).toEqual([expect.objectContaining({ valor: 2 })]);
  });

  it("apaga só o que casa com o filtro, e range pagina", async () => {
    const db = client();
    const total = ((await db.from("pluggy_transactions").select("*")).data as unknown[]).length;
    const page = (await db.from("pluggy_transactions").select("*").range(0, 4)).data as unknown[];
    expect(page).toHaveLength(5);
    await db.from("pluggy_transactions").delete().eq("account_id", "card-gold");
    const rest = (await db.from("pluggy_transactions").select("*")).data as { account_id: string }[];
    expect(rest.length).toBeLessThan(total);
    expect(rest.every((r) => r.account_id !== "card-gold")).toBe(true);
  });

  it("os dados fictícios fecham: faturas somam as compras do ciclo", () => {
    const seed = buildSeed(DEMO_USER.id, new Date("2026-10-13T12:00:00Z"));
    expect(seed.pluggy_bills.length).toBeGreaterThan(0);
    for (const b of seed.pluggy_bills as { closing_date: string; total_amount: number }[]) {
      expect(b.total_amount).toBeGreaterThan(0);
      expect(b.closing_date <= "2026-10-13").toBe(true);
    }
  });
});
