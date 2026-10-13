// MarketDataProvider via Yahoo Finance (API "chart" pública, sem token). Serve
// B3 com sufixo `.SA` (ex.: PETR4.SA) e devolve preço, volume E histórico numa
// única requisição — o que destrava retornos 1D/5D/20D, volume e volatilidade.
//
// Yahoo é NÃO-OFICIAL e pode instabilizar: `getSnapshot` cai pra BRAPI (cotação
// atual) se o Yahoo falhar. Todo acesso a mercado passa por aqui (spec §11).

import "server-only";
import { fetchQuotes } from "@/lib/market/brapi";
import { HISTORY } from "../../config";
import type { MarketDataProvider, MarketSnapshot, PricePoint } from "../../types";

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA = "Mozilla/5.0 (compatible; PrumoBot/1.0)";

interface ChartResult {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketVolume?: number;
  };
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[]; volume?: (number | null)[] }[] };
}

/**
 * Resolve o símbolo Yahoo. Só um TICKER da B3 (4 letras + 1-2 dígitos, ex.: PETR4,
 * TAEE11) ganha o sufixo `.SA`. Tudo mais — índices (^BVSP), futuros (BZ=F),
 * câmbio (USDBRL=X) e cripto (BTC-USD) — passa direto. (Antes, "BTC-USD" virava
 * "BTC-USD.SA" e falhava.)
 */
export function toYahooSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (t.endsWith(".SA")) return t;
  if (/^[A-Z]{4}\d{1,2}$/.test(t)) return `${t}.SA`;
  return t;
}

async function fetchChart(symbol: string, range: string): Promise<ChartResult | null> {
  const url = `${BASE}/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { chart?: { result?: ChartResult[] } };
    return data.chart?.result?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Extrai closes/volumes válidos (descarta candles sem fechamento). */
function series(result: ChartResult): { closes: number[]; volumes: number[] } {
  const q = result.indicators?.quote?.[0];
  const rawClose = q?.close ?? [];
  const rawVol = q?.volume ?? [];
  const closes: number[] = [];
  const volumes: number[] = [];
  for (let i = 0; i < rawClose.length; i++) {
    const c = rawClose[i];
    if (c == null || Number.isNaN(c)) continue;
    closes.push(c);
    volumes.push(rawVol[i] ?? 0);
  }
  return { closes, volumes };
}

/** Retorno percentual entre o último fechamento e o de N pregões atrás. */
export function returnOver(closes: number[], n: number): number | null {
  if (closes.length <= n) return null;
  const last = closes[closes.length - 1];
  const past = closes[closes.length - 1 - n];
  if (!past) return null;
  return (last - past) / past;
}

/** Desvio-padrão dos retornos diários na janela (proxy de volatilidade). */
export function volatility(closes: number[], window: number): number | null {
  if (closes.length < 3) return null;
  const slice = closes.slice(-Math.min(window + 1, closes.length));
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const prev = slice[i - 1];
    if (prev) rets.push((slice[i] - prev) / prev);
  }
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}

export const yahooProvider: MarketDataProvider = {
  name: "yahoo",

  async getSnapshot(ticker: string): Promise<MarketSnapshot | null> {
    const symbol = toYahooSymbol(ticker);
    const result = await fetchChart(symbol, "3mo");

    if (!result) {
      // Fallback BRAPI: só cotação atual (sem histórico/volume).
      const q = await fetchQuotes([ticker]);
      const price = q[ticker.toUpperCase()]?.price ?? null;
      return price == null ? null : { ticker: ticker.toUpperCase(), price };
    }

    const { closes, volumes } = series(result);
    const meta = result.meta ?? {};
    const price = meta.regularMarketPrice ?? closes[closes.length - 1] ?? null;

    // return1d a partir dos dois últimos fechamentos da série. NÃO usar
    // meta.chartPreviousClose: esse campo é o fechamento anterior ao INÍCIO da
    // janela (~3 meses atrás no range "3mo"), não o pregão anterior.
    const return1d = returnOver(closes, 1);

    const window = Math.min(HISTORY.mediumWindow, volumes.length);
    const recentVols = volumes.slice(-window).filter((v) => v > 0);
    const avgVolume =
      recentVols.length > 0 ? recentVols.reduce((s, v) => s + v, 0) / recentVols.length : null;
    const volume = meta.regularMarketVolume ?? volumes[volumes.length - 1] ?? null;

    return {
      ticker: ticker.toUpperCase(),
      price,
      return1d,
      return5d: returnOver(closes, HISTORY.shortWindow),
      return20d: returnOver(closes, HISTORY.mediumWindow),
      volume,
      avgVolume,
      volumeAnomaly: avgVolume && volume ? volume / avgVolume : null,
      volatility: volatility(closes, HISTORY.volatilityWindow),
    };
  },

  async getHistory(ticker: string, days: number): Promise<PricePoint[]> {
    const symbol = toYahooSymbol(ticker);
    const range =
      days <= 30
        ? "1mo"
        : days <= 90
          ? "3mo"
          : days <= 180
            ? "6mo"
            : days <= 365
              ? "1y"
              : days <= 730
                ? "2y"
                : days <= 1825
                  ? "5y"
                  : "10y";
    const result = await fetchChart(symbol, range);
    if (!result) return [];
    const q = result.indicators?.quote?.[0];
    const ts = result.timestamp ?? [];
    const closes = q?.close ?? [];
    const vols = q?.volume ?? [];
    const points: PricePoint[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c == null || Number.isNaN(c)) continue;
      points.push({ date: new Date(ts[i] * 1000), close: c, volume: vols[i] ?? null });
    }
    return points.slice(-days);
  },
};

/** Cotação detalhada do dia (para o card de detalhe do ativo, estilo Google). */
export interface QuoteDetail {
  name: string | null;
  price: number | null;
  previousClose: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  week52High: number | null;
  week52Low: number | null;
  volume: number | null;
}

/** Puxa nome, abertura, máx/mín do dia e 52 semanas do meta do Yahoo (range=1d). */
export async function getQuoteDetail(ticker: string): Promise<QuoteDetail | null> {
  const symbol = toYahooSymbol(ticker);
  const url = `${BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 120 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: {
        result?: {
          meta?: Record<string, number | string | undefined>;
          indicators?: { quote?: { open?: (number | null)[] }[] };
        }[];
      };
    };
    const r = data.chart?.result?.[0];
    if (!r) return null;
    const m = r.meta ?? {};
    const opens = r.indicators?.quote?.[0]?.open ?? [];
    const open = [...opens].reverse().find((v) => v != null) ?? null;
    const numOf = (v: number | string | undefined) => (typeof v === "number" ? v : null);
    return {
      name: (m.longName as string) ?? (m.shortName as string) ?? null,
      price: numOf(m.regularMarketPrice),
      previousClose: numOf(m.chartPreviousClose) ?? numOf(m.previousClose),
      open,
      dayHigh: numOf(m.regularMarketDayHigh),
      dayLow: numOf(m.regularMarketDayLow),
      week52High: numOf(m.fiftyTwoWeekHigh),
      week52Low: numOf(m.fiftyTwoWeekLow),
      volume: numOf(m.regularMarketVolume),
    };
  } catch {
    return null;
  }
}
