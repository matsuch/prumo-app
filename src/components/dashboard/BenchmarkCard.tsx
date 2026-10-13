// Card "Carteira vs. mercado": compara a rentabilidade acumulada da carteira com
// CDI e IBOV no mesmo período (mesmos fluxos). Destaca o "% do CDI" — a régua que
// o investidor PF usa. Apresentacional: recebe as frações já calculadas.

import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { pct } from "@/lib/domain/dashboardMetrics";
import { pctOfBenchmark } from "@/lib/domain/benchmark";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MiniStat } from "./StatCards";

export function BenchmarkCard({
  rentab,
  cdi,
  ibov,
  caption,
}: {
  rentab: number; // rentabilidade acumulada da carteira (fração)
  cdi: number | null;
  ibov: number | null;
  caption?: string | null;
}) {
  const pctCDI = cdi != null ? pctOfBenchmark(rentab, cdi) : null;
  const batendoCDI = cdi != null && rentab >= cdi;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle className="text-sm">Carteira vs. mercado</CardTitle>
          {caption && <span className="text-muted-foreground text-xs">{caption}</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pctCDI != null && (
          <div className="flex items-center gap-2">
            {batendoCDI ? (
              <TrendingUp className="text-positive size-5 shrink-0" aria-hidden="true" />
            ) : (
              <TrendingDown className="text-destructive size-5 shrink-0" aria-hidden="true" />
            )}
            <span className="text-2xl font-semibold tabular-nums">
              {(pctCDI * 100).toFixed(0).replace(".", ",")}%
            </span>
            <span className="text-muted-foreground text-sm">
              do CDI —{" "}
              <span className={cn("font-medium", batendoCDI ? "text-positive" : "text-destructive")}>
                {batendoCDI ? "batendo o CDI" : "abaixo do CDI"}
              </span>
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <MiniStat
            label="Sua carteira"
            value={pct(rentab)}
            tone={rentab >= 0 ? "positive" : "negative"}
          />
          <MiniStat label="CDI" value={cdi != null ? pct(cdi) : "—"} />
          <MiniStat label="IBOV" value={ibov != null ? pct(ibov) : "—"} />
        </div>

        <p className="text-muted-foreground text-[11px]">
          Rentabilidade acumulada no período, aplicando seus aportes/resgates às mesmas datas em cada
          índice. Estimativa — não considera custos nem impostos.
        </p>
      </CardContent>
    </Card>
  );
}
