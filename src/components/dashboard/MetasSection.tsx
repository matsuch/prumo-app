// Card "Metas": progresso de cada meta de longo prazo e o aporte necessário para
// alcançá-la. Recebe a função `projetar` do Dashboard (que já conhece a carteira
// e o macro atual) para simular o patrimônio no prazo de cada meta.

import { formatBRL, formatBRLCents } from "@/lib/domain/currency";
import { analyzeGoal, anosAte } from "@/lib/domain/goalPlanning";
import type { Goal } from "@/lib/supabase/goals";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";

export function MetasSection({
  goals,
  patrimonio,
  projetar,
  mobile = false,
}: {
  goals: Goal[];
  patrimonio: number;
  projetar: (anos: number, ap: number) => number;
  /** Modo celular: nome da meta em linha própria (não corta) e valores abaixo. */
  mobile?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-sm">Metas</CardTitle>
          <span className="text-muted-foreground text-xs">
            {goals.length} meta{goals.length === 1 ? "" : "s"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.map((g) => {
          const anos = anosAte(g.dataAlvo);
          const a = analyzeGoal(g.valorAlvo, anos, patrimonio, g.aporteMensal, (ap) =>
            projetar(anos, ap),
          );
          const progresso = Math.min(Math.max(a.progressoHoje, 0) * 100, 100);
          const status = a.atinge
            ? "🎯 no caminho"
            : a.aporteNecessario === Infinity
              ? "prazo curto demais"
              : `faltam ${formatBRLCents(a.aporteNecessario)}/mês`;
          return (
            <div key={g.id}>
              <div
                className={cn(
                  "mb-1 gap-2 text-sm",
                  mobile ? "space-y-0.5" : "flex items-baseline justify-between",
                )}
              >
                <span className={cn("font-medium", !mobile && "truncate")}>
                  {g.nome || "Meta"}
                </span>
                <span
                  className={cn(
                    "text-muted-foreground text-xs tabular-nums",
                    mobile ? "block" : "shrink-0",
                  )}
                >
                  {mobile ? formatBRL(patrimonio) : formatBRLCents(patrimonio)} /{" "}
                  {formatBRL(g.valorAlvo)}
                </span>
              </div>
              <Progress
                value={progresso}
                indicatorClassName={a.atinge ? "bg-positive" : undefined}
              />
              <div
                className={cn(
                  "text-muted-foreground mt-1 flex gap-2 text-xs",
                  mobile
                    ? "flex-wrap items-baseline justify-between"
                    : "items-center justify-between",
                )}
              >
                <span>
                  {(a.progressoHoje * 100).toFixed(0)}% · até{" "}
                  {new Date(`${g.dataAlvo}T00:00:00Z`).toLocaleDateString("pt-BR")}
                </span>
                <span className={a.atinge ? "text-positive shrink-0" : "shrink-0"}>{status}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
