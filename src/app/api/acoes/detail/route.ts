// Detalhe de um ativo para o card estilo Google (/acoes/[ticker]): cotação do
// dia (Yahoo), indicadores fundamentalistas (Fundamentus) e histórico p/ o
// gráfico. Exige sessão logada.

import { createClient } from "@/lib/supabase/server";
import { getQuoteDetail } from "@/lib/market-intelligence/providers/market/yahoo";
import { yahooProvider } from "@/lib/market-intelligence/providers/market/yahoo";
import { getFundamentalsDetail } from "@/lib/market-intelligence/providers/market/fundamentus";
import { marketIntelligence } from "@/lib/market-intelligence";

export const dynamic = "force-dynamic";

const HISTORY_DAYS = 366;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return new Response("Unauthorized", { status: 401 });

  const ticker = new URL(request.url).searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker || !/^[A-Z0-9.]{4,10}$/.test(ticker)) {
    return Response.json({ error: "Ticker inválido." }, { status: 400 });
  }

  const [quote, detail, history, factors] = await Promise.all([
    getQuoteDetail(ticker),
    getFundamentalsDetail(ticker).catch(() => null),
    yahooProvider.getHistory(ticker, HISTORY_DAYS).catch(() => []),
    marketIntelligence.assetFactorReactions(ticker).catch(() => []),
  ]);

  if (!quote || quote.price == null) {
    return Response.json(
      { error: `Não encontrei cotação para "${ticker}".` },
      { status: 404 },
    );
  }

  const change =
    quote.price != null && quote.previousClose
      ? {
          abs: quote.price - quote.previousClose,
          pct: (quote.price - quote.previousClose) / quote.previousClose,
        }
      : null;

  return Response.json(
    {
      ticker,
      name: quote.name ?? detail?.company ?? null,
      quote,
      change,
      company: detail
        ? { sector: detail.sector, subsector: detail.subsector, type: detail.type }
        : null,
      marketCap: detail?.marketCap ?? null,
      groups: detail?.groups ?? [],
      history: history.map((p) => ({ date: p.date.toISOString(), close: p.close })),
      factors,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
