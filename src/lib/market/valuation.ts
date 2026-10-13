// Valoração a mercado da carteira manual (renda fixa + ações), usada tanto
// pela chamada síncrona do dashboard (/api/carteira) quanto pelo snapshot
// diário automático (/api/cron/snapshot). Fica de fora das rotas para não
// duplicar a lógica de busca de séries/cotações entre as duas.

import { fetchSerie, SGS, type SeriePonto } from "@/lib/market/bacen";
import { fetchQuotes } from "@/lib/market/brapi";
import {
  calcFixedIncome,
  menorDataAplicacao,
  type FixedIncomePosition,
  type RentabilidadeResult,
  type Series,
} from "@/lib/domain/fixedIncome";
import { calcStock, type StockPosition, type StockResult } from "@/lib/domain/stocks";

export interface CarteiraValuation {
  fixedResults: ({ id: string } & RentabilidadeResult)[];
  stockResults: ({ id: string; shortName?: string } & StockResult)[];
  warnings: string[];
  updatedAt: string;
}

export async function valuateCarteira(
  fixed: FixedIncomePosition[],
  stocks: StockPosition[],
): Promise<CarteiraValuation> {
  const hoje = new Date();

  const series: Series = { cdi: [], selic: [], ipca: [] };
  const tarefas: Promise<void>[] = [];
  const empty: SeriePonto[] = [];

  const inicioCdi = menorDataAplicacao(fixed, ["CDI"]);
  if (inicioCdi)
    tarefas.push(fetchSerie(SGS.CDI, inicioCdi, hoje).then((s) => void (series.cdi = s)).catch(() => void (series.cdi = empty)));

  const inicioSelic = menorDataAplicacao(fixed, ["SELIC"]);
  if (inicioSelic)
    tarefas.push(fetchSerie(SGS.SELIC, inicioSelic, hoje).then((s) => void (series.selic = s)).catch(() => void (series.selic = empty)));

  const inicioIpca = menorDataAplicacao(fixed, ["IPCA"]);
  if (inicioIpca)
    tarefas.push(fetchSerie(SGS.IPCA, inicioIpca, hoje).then((s) => void (series.ipca = s)).catch(() => void (series.ipca = empty)));

  const warnings: string[] = [];
  const tickers = stocks.map((s) => s.ticker);

  await Promise.all(tarefas);
  const quotes = tickers.length ? await fetchQuotes(tickers) : {};

  const fixedResults = fixed.map((p) => ({ id: p.id, ...calcFixedIncome(p, hoje, series) }));
  const stockResults = stocks.map((s) => {
    const q = quotes[s.ticker.trim().toUpperCase()];
    return { id: s.id, shortName: q?.shortName, ...calcStock(s, q?.price ?? null, hoje) };
  });

  const semCotacao = [
    ...new Set(
      stocks
        .filter((_, i) => stockResults[i].valorAtual == null)
        .map((s) => s.ticker.trim().toUpperCase()),
    ),
  ].filter(Boolean);
  if (semCotacao.length) {
    warnings.push(
      `Sem cotação para: ${semCotacao.join(", ")}. Verifique o ticker; no plano grátis do brapi pode haver limite de requisições.`,
    );
  }

  return { fixedResults, stockResults, warnings, updatedAt: hoje.toISOString() };
}
