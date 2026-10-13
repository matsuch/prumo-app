// MODO DEMO / versão pública: só os tipos usados pelos provedores de cotação
// (Yahoo, Fundamentus). Os tipos da engine ficam na versão privada.

/** Métricas de mercado de um ativo num instante (via MarketDataProvider). */
export interface MarketSnapshot {
  ticker: string;
  price: number | null;
  return1d?: number | null;
  return5d?: number | null;
  return20d?: number | null;
  volume?: number | null;
  avgVolume?: number | null;
  volumeAnomaly?: number | null; // volume / avgVolume
  volatility?: number | null; // desvio-padrão dos retornos diários (janela)
}

/** Ponto de histórico de preço. */
export interface PricePoint {
  date: Date;
  close: number;
  volume?: number | null;
}

/** Provider desacoplado de dados de mercado (spec §11). */
export interface MarketDataProvider {
  readonly name: string;
  getSnapshot(ticker: string): Promise<MarketSnapshot | null>;
  getHistory(ticker: string, days: number): Promise<PricePoint[]>;
}

/** Fundamentos de um ativo (P/L, P/VP, ROE, Dividend Yield). Fração p/ percentuais. */
export interface Fundamentals {
  pl: number | null; // P/L
  pvp: number | null; // P/VP
  roe: number | null; // ROE (fração, ex.: 0.277)
  dy: number | null; // Dividend Yield (fração, ex.: 0.071)
}

