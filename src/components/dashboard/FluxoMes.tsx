// Card "Fluxo do mês": entrada − gastos fixos − fatura = sobra, com a escala de
// taxa de poupança. Apresentacional (sem estado próprio) — todos os números vêm
// calculados do Dashboard.
//
// `mobile` troca a arrumação para a tela do celular (navegação de mês em linha
// própria com área de toque maior, linhas empilhadas e valores sem centavos);
// o layout desktop é exatamente o mesmo de antes.

import { ChevronLeft, ChevronRight, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatBRLCents } from "@/lib/domain/currency";
import { pct } from "@/lib/domain/dashboardMetrics";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MiniStat } from "./StatCards";

export interface FluxoMesProps {
  entrada: number | null;
  gastosFixos: number;
  gastosPago: number;
  gastosPendente: number;
  fatura: number | null;
  faturaCaption?: string;
  sobra: number;
  meta: number;
  livre: number;
  taxaPoupanca: number | null;
  comprometimento: number | null;
  mesLabel: string;
  mesAtualLabel: string | null;
  pendenteMesAtual: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  isAnchor: boolean;
  onReset: () => void;
  mobile?: boolean;
}

export function FluxoMes({
  entrada,
  gastosFixos,
  gastosPago,
  gastosPendente,
  fatura,
  faturaCaption,
  sobra,
  meta,
  livre,
  taxaPoupanca,
  comprometimento,
  mesLabel,
  mesAtualLabel,
  pendenteMesAtual,
  onPrev,
  onNext,
  canPrev,
  canNext,
  isAnchor,
  onReset,
  mobile = false,
}: FluxoMesProps) {
  // No celular os valores vão sem centavos: cabem na coluna sem quebrar linha.
  const fmt = mobile ? formatBRL : formatBRLCents;

  const nav = (
    <div className={cn("flex items-center gap-1", mobile && "w-full justify-between")}>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="Mês anterior"
        className={cn(
          "text-muted-foreground hover:text-foreground disabled:opacity-30",
          // -m-2 p-2 amplia a área de toque sem mexer no layout.
          mobile ? "grid size-11 place-items-center rounded-md" : "-m-2 p-2",
        )}
      >
        <ChevronLeft className={mobile ? "size-5" : "size-4"} />
      </button>
      <Badge
        variant="secondary"
        className={cn(
          "justify-center capitalize",
          mobile ? "min-w-32 py-1 text-xs" : "min-w-24 text-[10px]",
        )}
      >
        {mesLabel}
      </Badge>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="Próximo mês"
        className={cn(
          "text-muted-foreground hover:text-foreground disabled:opacity-30",
          mobile ? "grid size-11 place-items-center rounded-md" : "-m-2 p-2",
        )}
      >
        <ChevronRight className={mobile ? "size-5" : "size-4"} />
      </button>
      {!isAnchor && (
        <button
          type="button"
          onClick={onReset}
          className={cn(
            "text-primary hover:underline",
            mobile ? "px-2 py-2 text-xs" : "ml-1 text-[11px]",
          )}
        >
          hoje
        </button>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        {mobile ? (
          <div className="space-y-2">
            <CardTitle className="text-sm">Fluxo do mês</CardTitle>
            {nav}
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Fluxo do mês</CardTitle>
              {nav}
            </div>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              entrada − gastos fixos − fatura{meta > 0 ? " − meta" : ""}
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn("grid grid-cols-2 gap-3", !mobile && "sm:grid-cols-4")}>
          <MiniStat
            label="Entrada"
            value={entrada != null ? fmt(entrada) : "—"}
            tone={entrada != null ? "positive" : undefined}
          />
          <MiniStat
            label="Gastos fixos"
            value={`− ${fmt(gastosFixos)}`}
            tone="negative"
            caption={
              gastosPago > 0
                ? `pago ${fmt(gastosPago)} · falta ${fmt(gastosPendente)}`
                : undefined
            }
          />
          <MiniStat
            label="Fatura"
            value={fatura != null ? `− ${fmt(fatura)}` : "—"}
            tone={fatura != null ? "negative" : undefined}
            caption={faturaCaption}
          />
          <MiniStat
            label="Sobra"
            value={fmt(sobra)}
            tone={sobra >= 0 ? "positive" : "negative"}
          />
        </div>

        {meta > 0 && (
          <div
            className={cn(
              "border-primary/30 bg-primary/5 gap-2 rounded-md border px-3 py-2",
              mobile ? "space-y-1.5" : "flex items-center justify-between",
            )}
          >
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Target className="text-primary size-3.5 shrink-0" aria-hidden="true" />
              Meta <span className="text-foreground font-medium">para investir</span>
              {!mobile && <span className="hidden sm:inline">· desconta da sobra</span>}
            </span>
            <span className={cn("flex items-baseline gap-3", mobile && "justify-between")}>
              <span className="text-primary text-sm font-semibold tabular-nums">
                − {fmt(meta)}
              </span>
              <span className="text-xs">
                <span className="text-muted-foreground">Livre </span>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    livre >= 0 ? "text-foreground" : "text-destructive",
                  )}
                >
                  {fmt(livre)}
                </span>
              </span>
            </span>
          </div>
        )}

        {mesAtualLabel && pendenteMesAtual > 0 && (
          <div
            className={cn(
              "border-border/60 gap-2 rounded-md border border-dashed px-3 py-2",
              mobile
                ? "flex flex-wrap items-center justify-between"
                : "flex items-center justify-between",
            )}
          >
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5 shrink-0" aria-hidden="true" />
              Ainda em <span className="text-foreground font-medium capitalize">{mesAtualLabel}</span>
              {!mobile && <span className="hidden sm:inline">· gastos fixos a pagar</span>}
            </span>
            <span className="text-destructive text-sm font-semibold tabular-nums">
              − {fmt(pendenteMesAtual)}
            </span>
          </div>
        )}

        {taxaPoupanca != null ? (
          <PoupancaScale taxa={taxaPoupanca} comprometimento={comprometimento} mobile={mobile} />
        ) : (
          <p className="text-muted-foreground text-xs">
            Informe a{" "}
            <span className="text-foreground font-medium">Entrada do mês</span> no Cadastro para ver
            taxa de poupança e comprometimento.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const POUPANCA_ZONAS = [
  { label: "Ruim", min: -Infinity },
  { label: "Razoável", min: 0.05 },
  { label: "Bom", min: 0.15 },
  { label: "Excelente", min: 0.3 },
];

function PoupancaScale({
  taxa,
  comprometimento,
  mobile = false,
}: {
  taxa: number;
  comprometimento: number | null;
  mobile?: boolean;
}) {
  let idx = 0;
  for (let i = 0; i < POUPANCA_ZONAS.length; i += 1) if (taxa >= POUPANCA_ZONAS[i].min) idx = i;
  const fill = Math.min(Math.max(taxa, 0) / 0.4, 1) * 100;
  const cor = idx >= 3 ? "bg-positive" : idx >= 1 ? "bg-primary" : "bg-destructive";
  return (
    <div>
      <div
        className={cn(
          "mb-1 gap-2",
          mobile ? "space-y-0.5" : "flex items-baseline justify-between",
        )}
      >
        <span className={mobile ? "block" : undefined}>
          <strong className="text-lg tabular-nums">{pct(taxa)}</strong>{" "}
          <span className="text-muted-foreground text-xs">taxa de poupança</span>
        </span>
        {comprometimento != null && (
          <span className={cn("text-muted-foreground text-xs tabular-nums", mobile && "block")}>
            {pct(comprometimento)} comprometido
          </span>
        )}
      </div>
      <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
        <div className={cn("h-full rounded-full", cor)} style={{ width: `${fill}%` }} />
      </div>
      <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
        {POUPANCA_ZONAS.map((z, i) => (
          <span key={z.label} className={i === idx ? "text-foreground font-medium" : ""}>
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}
