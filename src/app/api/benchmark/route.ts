// Comparação da carteira com CDI e IBOV. Recebe a série de "investido" (dos
// snapshots) + valor atual, reconstrói os fluxos de caixa e aplica os MESMOS
// fluxos ao CDI (BACEN) e ao IBOV (Yahoo) para uma comparação money-weighted.
// Dados públicos (CDI/IBOV); a série vem do próprio cliente (dados do usuário).

import { buildCashFlows, type InvestidoPoint } from "@/lib/domain/portfolioPerformance";
import { benchmarkAccumulated, makeGrowthToEnd, type IndexPoint } from "@/lib/domain/benchmark";
import { fetchSerie, SGS } from "@/lib/market/bacen";
import { yahooProvider } from "@/lib/market-intelligence/providers/market/yahoo";
import { getSessionUser, unauthorized } from "@/lib/server/auth";

interface Payload {
  series?: InvestidoPoint[];
  today?: string;
  patrimonio?: number;
  investido?: number;
}

function isoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** CDI (série 12, % a.d.) → pontos de fator acumulado composto. */
async function cdiPoints(inicio: Date, fim: Date): Promise<IndexPoint[]> {
  const serie = await fetchSerie(SGS.CDI, inicio, fim);
  let cum = 1;
  return serie.map((s) => {
    cum *= 1 + s.valor / 100;
    return { date: isoUTC(s.data), factor: cum };
  });
}

/** IBOV (^BVSP) → pontos de preço de fechamento como fator. */
async function ibovPoints(days: number): Promise<IndexPoint[]> {
  const hist = await yahooProvider.getHistory("^BVSP", days);
  return hist.map((p) => ({ date: isoUTC(p.date), factor: p.close }));
}

export async function POST(request: Request) {
  if (!(await getSessionUser())) return unauthorized();
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const series = body.series ?? [];
  const today = body.today ?? isoUTC(new Date());
  const patrimonio = body.patrimonio ?? 0;
  const investido = body.investido ?? 0;

  // Reproduz os fluxos da carteira (mesma base do portfolioPerformance) e separa
  // as contribuições (aportes/resgates) do fluxo final de avaliação.
  const fullSeries: InvestidoPoint[] = [...series, { date: today, investido }];
  const flows = buildCashFlows(fullSeries, { date: today, patrimonio });
  const contribs = flows.slice(0, -1);
  if (contribs.length === 0) {
    return Response.json({ cdi: null, ibov: null, periodStart: null });
  }

  const start = contribs
    .map((f) => f.date)
    .sort()[0];
  const inicio = new Date(`${start}T00:00:00Z`);
  const fim = new Date(`${today}T00:00:00Z`);
  const days = Math.ceil((fim.getTime() - inicio.getTime()) / 86_400_000) + 5;

  // CDI e IBOV são best-effort e independentes: falha em um não derruba o outro.
  const [cdiRes, ibovRes] = await Promise.allSettled([cdiPoints(inicio, fim), ibovPoints(days)]);

  const cdi =
    cdiRes.status === "fulfilled" && cdiRes.value.length
      ? (benchmarkAccumulated(contribs, makeGrowthToEnd(cdiRes.value))?.acumulada ?? null)
      : null;
  const ibov =
    ibovRes.status === "fulfilled" && ibovRes.value.length
      ? (benchmarkAccumulated(contribs, makeGrowthToEnd(ibovRes.value))?.acumulada ?? null)
      : null;

  return Response.json({ cdi, ibov, periodStart: start });
}
