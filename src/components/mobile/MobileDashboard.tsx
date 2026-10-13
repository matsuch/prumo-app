"use client";

// Interface MOBILE do Dashboard (uma coluna, largura cheia, toque confortável).
//
// É uma VISÃO: não busca nem calcula nada — recebe pronto tudo o que o
// Dashboard já computa para o desktop e reorganiza para a tela do celular:
//   · hierarquia: patrimônio em destaque → rendimento/rentabilidade → caixa,
//     fatura e entrada → fluxo do mês → o resto;
//   · cards empilhados, sem grade de 4 colunas e sem rolagem horizontal;
//   · valores sem centavos nos números grandes (cabem sem quebrar a linha);
//   · a ação de integração/atualização do Pluggy fica fixa no topo, sempre
//     ao alcance do polegar.

import Link from "next/link";
import { RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/domain/currency";
import { pct, type Produto, type Periodo, type Trend } from "@/lib/domain/dashboardMetrics";
import type { Suggestion } from "@/lib/domain/portfolioHealth";
import type { Goal } from "@/lib/supabase/goals";
import type { Macro } from "@/lib/domain/marketAssumptions";
import type { ScenarioBand } from "@/lib/domain/projection";
import MobileShell from "./MobileShell";
import AllocationPieChart, { type AllocationSlice } from "../AllocationPieChart";
import HistoryChart, { type HistoryPoint } from "../HistoryChart";
import ProjectionChart from "../ProjectionChart";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { HELP_RENDIMENTO, helpRentabilidade, MiniStat } from "../dashboard/StatCards";
import { FluxoMes, type FluxoMesProps } from "../dashboard/FluxoMes";
import { CompositionBar } from "../dashboard/CompositionBar";
import { MetasSection } from "../dashboard/MetasSection";
import { SuggestionsCard } from "../dashboard/SuggestionsCard";
import { BenchmarkCard } from "../dashboard/BenchmarkCard";
import { MacroControls, PeriodToggle } from "../dashboard/Controls";

/** Tudo o que o Dashboard já calculou, no formato que a tela mobile consome. */
export interface MobileDashboardData {
  patrimonio: number;
  rendimento: number;
  rentab: number;
  rentabAnual: number | null;
  trendInvest: Trend | null;
  trendRend: Trend | null;
  trendRentab: Trend | null;
  trendCaption: string | null;

  /** null quando o usuário não tem contas/cartões conectados. */
  caixa: number | null;
  faturas: number | null;
  faturaMesLabel: string | null;
  entradaMes: number | null;
  hasAccounts: boolean;

  fluxo: FluxoMesProps | null;
  suggestions: Suggestion[];
  produtos: Produto[];
  alocacao: AllocationSlice[];
  pluggyCount: number;

  goals: Goal[];
  projetar: (anos: number, aporte: number) => number;

  benchmark: {
    rentab: number;
    cdi: number | null;
    ibov: number | null;
    caption: string | null;
  } | null;

  historico: {
    total: number;
    filtrado: HistoryPoint[];
    periodo: Periodo;
    onPeriodo: (p: Periodo) => void;
  } | null;

  projecao: {
    band: ScenarioBand;
    years: number;
    onYears: (n: number) => void;
    aporte: number;
    onAporte: (n: number) => void;
    macro: Macro;
    onMacro: (m: Macro) => void;
    finalBase: number;
    finalPess: number;
    finalOtim: number;
    rendaPassiva: number;
    updatedAt: string | null;
  };
}

export interface MobileDashboardProps {
  email: string | null;
  loading: boolean;
  empty: boolean;
  error: string | null;
  syncing: boolean;
  syncMsg: string | null;
  /** Integração com o Pluggy: sincroniza as conexões e recarrega o dashboard. */
  onAtualizar: () => void;
  data: MobileDashboardData | null;
}

export default function MobileDashboard({
  email,
  loading,
  empty,
  error,
  syncing,
  syncMsg,
  onAtualizar,
  data,
}: MobileDashboardProps) {
  return (
    <MobileShell
      title="PRUMO"
      brand
      email={email}
      busy={syncing}
      action={
        <Button
          onClick={onAtualizar}
          disabled={syncing}
          aria-busy={syncing}
          aria-label={syncing ? "Atualizando os dados" : "Atualizar os dados das suas conexões"}
          className="h-11 gap-2 px-4 text-sm disabled:opacity-100"
        >
          <RefreshCw className={cn("size-4", syncing && "animate-spin")} aria-hidden="true" />
          {syncing ? "Atualizando…" : "Atualizar"}
        </Button>
      }
    >
      <div className="space-y-5">
        {(syncMsg || error) && (
          <div className="space-y-2">
            {syncMsg && (
              <p className="border-positive/30 bg-positive/10 text-positive rounded-md border px-3 py-2 text-xs">
                {syncMsg}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-xs"
              >
                ⚠ {error}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <MobileSkeleton />
        ) : empty || !data ? (
          <MobileEmpty />
        ) : (
          <MobileContent data={data} />
        )}
      </div>
    </MobileShell>
  );
}

// ---------------------------------------------------------------------------
// Conteúdo
// ---------------------------------------------------------------------------
function MobileContent({ data }: { data: MobileDashboardData }) {
  return (
    <>
      {/* 1. Patrimônio em destaque + as duas métricas de desempenho */}
      <Card className="gap-4 p-5">
        <div>
          <p className="text-muted-foreground text-xs font-medium">Patrimônio investido</p>
          <p className="mt-1 text-3xl leading-tight font-semibold tracking-tight tabular-nums">
            {formatBRL(data.patrimonio)}
          </p>
          {(data.trendInvest || data.trendCaption) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {data.trendInvest && <TrendBadge trend={data.trendInvest} />}
              {data.trendCaption && (
                <span className="text-muted-foreground text-[11px]">{data.trendCaption}</span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          <HeroStat
            label="Rendimento"
            value={formatBRL(data.rendimento)}
            tone={data.rendimento >= 0 ? "positive" : "negative"}
            trend={data.trendRend}
            help={HELP_RENDIMENTO}
          />
          <HeroStat
            label="Rentabilidade"
            value={pct(data.rentab)}
            tone={data.rentab >= 0 ? "positive" : "negative"}
            trend={data.trendRentab}
            help={helpRentabilidade(data.rentabAnual)}
          />
        </div>
      </Card>

      {/* 2. Caixa, fatura e entrada do mês (só o que existir) */}
      <SecondaryStats data={data} />

      {/* 3. Fluxo do mês */}
      {data.fluxo && <FluxoMes {...data.fluxo} mobile />}

      {/* 4. Sugestões de saúde da carteira */}
      <SuggestionsCard suggestions={data.suggestions} />

      {/* 5. Composição do patrimônio (lista de produtos é expansível) */}
      {data.hasAccounts && (
        <CompositionBar
          investimentos={data.patrimonio}
          caixa={data.caixa ?? 0}
          faturas={data.faturas ?? 0}
          produtos={data.produtos}
          mobile
        />
      )}

      {/* 6. Alocação por classe */}
      {data.alocacao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alocação por classe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AllocationPieChart data={data.alocacao} mobile />
            {data.pluggyCount > 0 && (
              <Link
                href="/conectar"
                className="text-muted-foreground flex min-h-11 items-center text-xs underline underline-offset-4"
              >
                Inclui {data.pluggyCount} posiç{data.pluggyCount === 1 ? "ão" : "ões"} do Pluggy →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* 7. Metas */}
      {data.goals.length > 0 && (
        <MetasSection
          goals={data.goals}
          patrimonio={data.patrimonio}
          projetar={data.projetar}
          mobile
        />
      )}

      {/* 8. Carteira vs. mercado */}
      {data.benchmark && (
        <BenchmarkCard
          rentab={data.benchmark.rentab}
          cdi={data.benchmark.cdi}
          ibov={data.benchmark.ibov}
          caption={data.benchmark.caption}
        />
      )}

      {/* 9. Evolução do patrimônio */}
      {data.historico && (
        <Card>
          <CardHeader className="gap-3">
            <CardTitle className="text-sm">Evolução do patrimônio</CardTitle>
            <PeriodToggle value={data.historico.periodo} onChange={data.historico.onPeriodo} mobile />
          </CardHeader>
          <CardContent className="px-3">
            <div className="text-muted-foreground mb-3 flex items-center gap-4 px-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="bg-primary h-0.5 w-4" /> Patrimônio
              </span>
              <span className="flex items-center gap-1">
                <span className="border-muted-foreground h-0 w-4 border-t border-dashed" /> Investido
              </span>
            </div>
            {data.historico.filtrado.length >= 2 ? (
              <HistoryChart data={data.historico.filtrado} mobile />
            ) : (
              <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                Poucos snapshots nesse período. Escolha um intervalo maior.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 10. Projeção */}
      <Card>
        <CardHeader className="gap-1">
          <CardTitle className="text-sm">Projeção da sua carteira</CardTitle>
          <p className="text-muted-foreground text-xs">
            Parte de {formatBRL(data.patrimonio)} e projeta com o retorno esperado de cada posição.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-3">
          <div className="space-y-4 px-3">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="mob-horizonte" className="text-muted-foreground text-xs">
                  Horizonte
                </label>
                <span className="text-sm font-medium tabular-nums">{data.projecao.years} anos</span>
              </div>
              <input
                id="mob-horizonte"
                type="range"
                min={1}
                max={40}
                value={data.projecao.years}
                onChange={(e) => data.projecao.onYears(Number(e.target.value))}
                className="accent-primary h-10 w-full"
                aria-label="Horizonte em anos"
              />
            </div>

            <div>
              <label htmlFor="mob-aporte" className="text-muted-foreground text-xs">
                Aporte mensal
              </label>
              <div className="border-input mt-1 flex h-11 items-center rounded-md border bg-transparent px-3">
                <span className="text-muted-foreground text-sm">R$</span>
                <input
                  id="mob-aporte"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  value={data.projecao.aporte}
                  onChange={(e) => data.projecao.onAporte(Math.max(0, Number(e.target.value)))}
                  className="h-full w-full min-w-0 bg-transparent pl-2 text-base tabular-nums outline-none"
                  aria-label="Aporte mensal em reais"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat label={`Em ${data.projecao.years} anos`} value={formatBRL(data.projecao.finalBase)} />
              <MiniStat label="Renda passiva/mês" value={formatBRL(data.projecao.rendaPassiva)} />
              <MiniStat label="Pessimista" value={formatBRL(data.projecao.finalPess)} />
              <MiniStat label="Otimista" value={formatBRL(data.projecao.finalOtim)} />
            </div>
          </div>

          <ProjectionChart band={data.projecao.band} mobile />

          <div className="px-3">
            <MacroControls macro={data.projecao.macro} onChange={data.projecao.onMacro} mobile />
            <p className="text-muted-foreground mt-3 text-xs">
              Valores nominais (antes da inflação).{" "}
              {data.projecao.updatedAt &&
                `Preços de ${new Date(data.projecao.updatedAt).toLocaleDateString("pt-BR")}.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 11. Eventos que tocam a carteira */}
    </>
  );
}

// ---------------------------------------------------------------------------
// Peças da tela mobile
// ---------------------------------------------------------------------------

// Caixa, fatura e entrada do mês em duas colunas. Um card sozinho na última
// linha ocupa a largura toda — sem meia-coluna vazia.
function SecondaryStats({ data }: { data: MobileDashboardData }) {
  const cards = [
    data.caixa != null && {
      key: "caixa",
      label: "Caixa",
      value: formatBRL(data.caixa),
      tone: undefined,
      badge: undefined,
    },
    data.faturas != null && {
      key: "fatura",
      label: "Fatura",
      value: `− ${formatBRL(data.faturas)}`,
      tone: "negative" as const,
      badge: data.faturaMesLabel ?? undefined,
    },
    {
      key: "entrada",
      label: "Entrada do mês",
      value: data.entradaMes != null ? formatBRL(data.entradaMes) : "—",
      tone: data.entradaMes != null ? ("positive" as const) : undefined,
      badge: undefined,
    },
  ].filter(Boolean) as {
    key: string;
    label: string;
    value: string;
    tone?: "positive" | "negative";
    badge?: string;
  }[];

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c, i) => (
        <MobileStat
          key={c.key}
          label={c.label}
          value={c.value}
          tone={c.tone}
          badge={c.badge}
          // ímpar: o último card fecha a linha inteira
          wide={cards.length % 2 === 1 && i === cards.length - 1}
        />
      ))}
    </div>
  );
}
function TrendBadge({ trend }: { trend: Trend }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-2 py-0.5 text-xs tabular-nums",
        trend.up ? "text-positive" : "text-destructive",
      )}
    >
      {trend.up ? (
        <TrendingUp className="size-3.5" aria-hidden="true" />
      ) : (
        <TrendingDown className="size-3.5" aria-hidden="true" />
      )}
      {trend.badge}
    </Badge>
  );
}

function HeroStat({
  label,
  value,
  tone,
  trend,
  help,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  trend: Trend | null;
  help?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        {help}
      </div>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "text-[11px] tabular-nums",
            trend.up ? "text-positive" : "text-destructive",
          )}
        >
          {trend.up ? "▲" : "▼"} {trend.badge}
        </p>
      )}
    </div>
  );
}

function MobileStat({
  label,
  value,
  tone,
  badge,
  wide = false,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  badge?: string;
  wide?: boolean;
}) {
  return (
    <Card className={cn("gap-1 p-4", wide && "col-span-2")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground min-w-0 text-xs font-medium">{label}</p>
        {badge && (
          <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px] capitalize">
            {badge}
          </Badge>
        )}
      </div>
      <p
        className={cn(
          "text-lg font-semibold tracking-tight tabular-nums",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function MobileSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando sua carteira">
      <div className="bg-card h-36 animate-pulse rounded-xl border" />
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card h-20 animate-pulse rounded-xl border" />
        <div className="bg-card h-20 animate-pulse rounded-xl border" />
      </div>
      <div className="bg-card h-56 animate-pulse rounded-xl border" />
      <p className="text-muted-foreground text-center text-sm">Carregando sua carteira…</p>
    </div>
  );
}

function MobileEmpty() {
  return (
    <Card className="border-dashed py-10 text-center">
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm">Você ainda não cadastrou nenhuma posição.</p>
        <Button asChild className="h-11 px-5">
          <Link href="/cadastro?aba=investimentos">Cadastrar minha carteira →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
