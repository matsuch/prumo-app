// Watchlist de ações + histórico de preços para a página /acoes. Exige sessão.
// GET   → tickers da watchlist do usuário + série de 1 ano (fechamento diário)
//         de cada um. O cliente fatia a janela (30/60/90/12m) e normaliza.
// POST   { ticker } → valida no Yahoo e adiciona à watchlist.
// DELETE ?ticker=   → remove da watchlist.

import { createClient } from "@/lib/supabase/server";
import { yahooProvider } from "@/lib/market-intelligence/providers/market/yahoo";

export const dynamic = "force-dynamic";

// 1 ano cobre todas as janelas (30/60/90/12m); o cliente fatia o resto.
const HISTORY_DAYS = 366;

export interface TickerSeries {
  ticker: string;
  points: { date: string; close: number }[];
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return { supabase, user: null };
  return { supabase, user };
}

/** Busca o histórico de 1 ano de cada ticker (em paralelo) e monta as séries. */
async function loadSeries(tickers: string[]): Promise<TickerSeries[]> {
  const series = await Promise.all(
    tickers.map(async (ticker) => {
      const points = await yahooProvider.getHistory(ticker, HISTORY_DAYS);
      return {
        ticker,
        points: points.map((p) => ({ date: p.date.toISOString(), close: p.close })),
      };
    }),
  );
  // Mantém apenas tickers que retornaram histórico utilizável.
  return series.filter((s) => s.points.length > 1);
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("watchlist")
    .select("ticker")
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const tickers = [...new Set((data ?? []).map((r) => r.ticker.toUpperCase()))];
  const series = await loadSeries(tickers);
  return Response.json({ tickers, series }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { ticker?: string };
  const ticker = body.ticker?.trim().toUpperCase();
  if (!ticker || !/^[A-Z0-9.]{4,10}$/.test(ticker)) {
    return Response.json({ error: "Ticker inválido." }, { status: 400 });
  }

  // Valida que o ativo existe / tem cotação antes de gravar.
  const snapshot = await yahooProvider.getSnapshot(ticker);
  if (!snapshot || snapshot.price == null) {
    return Response.json(
      { error: `Não encontrei cotação para "${ticker}". Confira o código.` },
      { status: 404 },
    );
  }

  const { error } = await supabase.from("watchlist").insert({ ticker });
  // 23505 = unique_violation → ticker já está na watchlist; trata como sucesso.
  if (error && error.code !== "23505") {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, ticker });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ticker = new URL(request.url).searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) return Response.json({ error: "ticker não informado" }, { status: 400 });

  const { error } = await supabase.from("watchlist").delete().eq("ticker", ticker);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
