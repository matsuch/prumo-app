// Cliente da brapi.dev — cotações de ações e FIIs da B3.
// Token via env BRAPI_TOKEN. O plano grátis permite apenas 1 ativo por
// requisição, então buscamos um ticker por vez (em paralelo).

import "server-only";
import { DEMO_QUOTES } from "@/lib/demo/quotes";

export interface Quote {
  ticker: string;
  price: number | null;
  shortName?: string;
}

async function fetchOne(ticker: string, token?: string): Promise<Quote | null> {
  const url = `https://brapi.dev/api/quote/${ticker}` + (token ? `?token=${token}` : "");
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: { symbol: string; regularMarketPrice?: number; shortName?: string }[];
    };
    const r = data.results?.[0];
    if (!r) return null;
    return {
      ticker: r.symbol.toUpperCase(),
      price: r.regularMarketPrice ?? null,
      shortName: r.shortName,
    };
  } catch {
    return null;
  }
}

/** Busca a cotação atual de vários tickers (uma requisição por ticker). */
export async function fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return {};

  const token = process.env.BRAPI_TOKEN;
  // Modo demo: sem token, a carteira fictícia usa cotações fixas (src/lib/demo).
  const results = await Promise.all(
    unique.map((t) =>
      !token && DEMO_QUOTES[t] != null
        ? Promise.resolve({ ticker: t, price: DEMO_QUOTES[t] })
        : fetchOne(t, token),
    ),
  );

  const map: Record<string, Quote> = {};
  for (const q of results) {
    if (q) map[q.ticker] = q;
  }
  return map;
}
