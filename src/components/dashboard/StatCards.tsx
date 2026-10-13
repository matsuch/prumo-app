// Primitivos de KPI do Dashboard: cartões de estatística (Stat/TrendStat/MiniStat),
// a legenda de série (Legend) e o conteúdo dos ícones de ajuda. Puramente
// apresentacional — recebe strings/valores já formatados.

import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import HelpPopover from "../HelpPopover";
import type { Trend } from "@/lib/domain/dashboardMetrics";

export function Stat({
  label,
  value,
  tone,
  badge,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  badge?: string;
}) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        {badge && (
          <Badge variant="outline" className="px-1.5 py-0 text-[11px] capitalize">
            {badge}
          </Badge>
        )}
      </div>
      <p
        className={cn(
          "text-xl font-semibold tracking-tight tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

export function TrendStat({
  label,
  value,
  tone,
  trend,
  caption,
  help,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  trend: Trend | null;
  caption: string | null;
  help?: React.ReactNode;
}) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          {help}
        </div>
        {trend && (
          <Badge
            variant="outline"
            className={cn(
              "gap-1 px-1.5 py-0 text-[11px] tabular-nums",
              trend.up ? "text-positive" : "text-destructive",
            )}
          >
            {trend.up ? (
              <TrendingUp className="size-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3" aria-hidden="true" />
            )}
            {trend.badge}
          </Badge>
        )}
      </div>
      <p
        className={cn(
          "text-xl font-semibold tracking-tight tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {trend && caption && <p className="text-muted-foreground text-[11px]">{caption}</p>}
    </Card>
  );
}

export function MiniStat({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  caption?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {caption && <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">{caption}</p>}
    </div>
  );
}

export function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label} <span className="text-foreground tabular-nums">{value}</span>
    </span>
  );
}

// Conteúdo dos ícones de ajuda. Fiel ao cálculo real (serviço portfolioPerformance):
//   capital líquido = aportes − resgates (custo das posições)
//   patrimônio      = valor ATUAL de tudo (RF corrigida, ações na cotação, Pluggy a mercado)
//   rendimento      = patrimônio − capital líquido (R$)
//   rentabilidade   = money-weighted (XIRR) acumulada, considerando as datas dos fluxos
export const HELP_RENDIMENTO = (
  <HelpPopover label="Como calculamos o rendimento?" title="Como calculamos o rendimento?">
    <p>
      Rendimento é <strong className="text-foreground">quanto seus investimentos ganharam em
      dinheiro</strong>. Considera a valorização da carteira e desconta os aportes e resgates
      feitos no período.
    </p>
    <p>
      <strong className="text-foreground">Valor atual dos investimentos − capital líquido
      investido</strong> (aportes − resgates).
    </p>
    <p>
      Colocar dinheiro (aporte) ou tirar (resgate) muda o patrimônio, mas não é rendimento — só a
      valorização efetiva conta. A setinha, quando aparece, compara com o mês anterior (em R$).
    </p>
  </HelpPopover>
);

export function helpRentabilidade(anualizada: number | null): React.ReactNode {
  return (
    <HelpPopover label="Como calculamos a rentabilidade?" title="Como calculamos a rentabilidade?">
      <p>
        Rentabilidade mostra o <strong className="text-foreground">desempenho percentual</strong> dos
        seus investimentos. O cálculo considera os aportes, os resgates e o período em que cada valor
        ficou investido, evitando que novos aportes distorçam o resultado.
      </p>
      <p>
        É a rentabilidade <strong className="text-foreground">acumulada desde o início</strong> (não
        anualizada). A setinha compara com o mês anterior, em pontos percentuais (pp).
      </p>
      {anualizada != null && (
        <p>
          Equivalente <strong className="text-foreground">anualizado</strong>:{" "}
          {`${(anualizada * 100).toFixed(1).replace(".", ",")}% ao ano`} — a taxa por ano no ritmo
          atual, uma métrica diferente da acumulada acima.
        </p>
      )}
    </HelpPopover>
  );
}
