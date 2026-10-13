"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "./ui/badge";
import AcoesChart, { type ChartLine } from "./AcoesChart";
import HelpPopover from "./HelpPopover";
import { formatBRLCents } from "@/lib/domain/currency";
import { INDICATOR_HELP } from "@/lib/domain/indicatorHelp";

interface Indicator {
  label: string;
  value: string;
}
interface FactorSens {
  factorKey: string;
  factorLabel: string;
  beta: number | null;
  correlation: number | null;
  hitRate: number | null;
  avgUp: number | null;
  avgDown: number | null;
  samples: number;
  leadCorrelation: number | null;
  leadHitRate: number | null;
  leadAvgUp: number | null;
  leadAvgDown: number | null;
  leadSamples: number;
}
interface Detail {
  ticker: string;
  name: string | null;
  quote: {
    price: number | null;
    previousClose: number | null;
    open: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    week52High: number | null;
    week52Low: number | null;
    volume: number | null;
  };
  change: { abs: number; pct: number } | null;
  company: { sector: string | null; subsector: string | null; type: string | null } | null;
  marketCap: number | null;
  groups: { title: string; items: Indicator[] }[];
  history: { date: string; close: number }[];
  factors?: FactorSens[];
  error?: string;
}

function fmtCompact(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2).replace(".", ",")} bi`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(2).replace(".", ",")} mi`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1).replace(".", ",")} mil`;
  return String(v);
}
function fmtPreco(v: number | null): string {
  return v == null ? "—" : formatBRLCents(v);
}
function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2).replace(".", ",")}%`;
}
function findIndicator(groups: Detail["groups"], label: string): string | null {
  for (const g of groups) {
    const it = g.items.find((i) => i.label === label);
    if (it) return it.value;
  }
  return null;
}

// Reação histórica do ativo aos fatores exógenos (20 pregões, 5 anos). É a base
// preditiva: "quando o fator anda, historicamente o ativo tende a andar assim".
function FatoresSection({ factors }: { factors: FactorSens[] }) {
  // Mostra os mais relevantes primeiro (já vêm ordenados por |correlação|).
  const top = factors.filter((f) => f.samples >= 8).slice(0, 8);
  if (top.length === 0) return null;

  const forcaLabel = (c: number) =>
    c >= 0.35 ? "forte" : c >= 0.2 ? "moderada" : "fraca";
  const forcaTone = (c: number) =>
    c >= 0.35 ? "text-foreground" : c >= 0.2 ? "text-muted-foreground" : "text-muted-foreground/60";

  return (
    <div className="p-4">
      <div className="mb-1 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">Sensibilidade a fatores</h3>
        <HelpPopover label="O que é isso?" title="Sensibilidade a fatores (20 dias)">
          <p>
            Mede como o ativo reagiu, historicamente (5 anos, janelas de 20 pregões), a
            fatores <strong className="text-foreground">exógenos</strong> — petróleo, dólar,
            minério, índices globais, cripto.
          </p>
          <p>
            <strong className="text-foreground">Correlação</strong> = força da relação;{" "}
            <strong className="text-foreground">acerto</strong> = % das vezes que andaram no mesmo
            sentido. É leitura estatística, <strong className="text-foreground">não</strong>{" "}
            garantia de repetição.
          </p>
        </HelpPopover>
      </div>
      <div className="divide-y">
        {top.map((f) => {
          const corr = f.correlation ?? 0;
          const abs = Math.abs(corr);
          const sobe = corr >= 0;
          return (
            <div key={f.factorKey} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {sobe ? (
                    <TrendingUp className="text-emerald-600 size-3.5 dark:text-emerald-400" />
                  ) : (
                    <TrendingDown className="text-red-600 size-3.5 dark:text-red-400" />
                  )}
                  {f.factorLabel}
                </span>
                <span className={`text-xs tabular-nums ${forcaTone(abs)}`}>
                  corr {corr.toFixed(2).replace(".", ",")} · {forcaLabel(abs)}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {f.factorLabel} {sobe ? "↑" : "↓"} → ativo{" "}
                <span className="tabular-nums">{fmtPct(sobe ? (f.avgUp ?? 0) : (f.avgDown ?? 0))}</span>{" "}
                em 20d · acerto{" "}
                <span className="tabular-nums">
                  {f.hitRate != null ? `${(f.hitRate * 100).toFixed(0)}%` : "—"}
                </span>{" "}
                <span className="text-muted-foreground/70">({f.samples} janelas)</span>
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground/70 mt-2 text-[11px]">
        Reação histórica a fatores exógenos (Yahoo, 5 anos). Leitura informativa, não recomendação.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** Painel lateral com o detalhe do ativo selecionado. Refaz a busca ao trocar de ticker. */
export default function AcaoDetalhe({ ticker, days }: { ticker: string; days: number }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // O pai remonta este painel via key={ticker}, então o estado inicial já vem
  // limpo (loading=true); o effect só faz setState nas continuações assíncronas.
  useEffect(() => {
    let alive = true;
    fetch(`/api/acoes/detail?ticker=${encodeURIComponent(ticker)}`)
      .then(async (r) => {
        const json = (await r.json()) as Detail;
        if (!r.ok) throw new Error(json.error ?? "Falha ao carregar o ativo.");
        return json;
      })
      .then((json) => alive && setData(json))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ticker]);

  const line: ChartLine[] = useMemo(() => {
    if (!data) return [];
    const points = data.history.map((p) => ({ date: new Date(p.date), close: p.close }));
    const last = points[points.length - 1];
    if (!last) return [];
    const cutoff = last.date.getTime() - days * 86_400_000;
    const window = points.filter((p) => p.date.getTime() >= cutoff);
    const pts = window.length >= 2 ? window : points;
    return [
      { ticker: data.ticker, color: "var(--primary)", points: pts.map((p) => ({ date: p.date, value: p.close })) },
    ];
  }, [data, days]);

  if (loading) {
    return (
      <div className="bg-card text-muted-foreground flex h-64 items-center justify-center rounded-lg border text-sm">
        Carregando {ticker}…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="bg-card rounded-lg border p-4 text-sm text-red-600 dark:text-red-400">
        {error ?? "Ativo não encontrado."}
      </div>
    );
  }

  const { quote, change } = data;
  const up = (change?.abs ?? 0) >= 0;
  const pl = findIndicator(data.groups, "P/L");
  const dy = findIndicator(data.groups, "Div. Yield");

  return (
    <div className="bg-card divide-y rounded-lg border">
      {/* Cabeçalho */}
      <div className="p-4">
        <h2 className="truncate text-lg font-bold tracking-tight" title={data.name ?? data.ticker}>
          {data.name ?? data.ticker}
        </h2>
        <p className="text-muted-foreground text-xs">
          BVMF: {data.ticker}
          {data.company?.type ? ` · ${data.company.type}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{fmtPreco(quote.price)}</span>
          <span className="text-muted-foreground text-xs">BRL</span>
          {change && (
            <Badge variant={up ? "default" : "destructive"} className="gap-1">
              {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {fmtPct(change.pct)}
            </Badge>
          )}
          {change && (
            <span className={`text-xs ${up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {up ? "+" : ""}
              {formatBRLCents(change.abs)} hoje
            </span>
          )}
        </div>
      </div>

      {/* Gráfico de preço (R$) na janela selecionada */}
      <div className="p-4">
        <AcoesChart lines={line} unit="R$" heightClass="h-52" selectable />
        <p className="text-muted-foreground mt-1 text-[11px]">Arraste no gráfico para ver a variação do período.</p>
      </div>

      {/* Estatísticas do dia (estilo Google) */}
      <div className="grid grid-cols-2 gap-x-6 p-4">
        <Stat label="Abertura" value={fmtPreco(quote.open)} />
        <Stat label="Máxima" value={fmtPreco(quote.dayHigh)} />
        <Stat label="Mínima" value={fmtPreco(quote.dayLow)} />
        <Stat label="Pré-fech." value={fmtPreco(quote.previousClose)} />
        <Stat label="Volume" value={fmtCompact(quote.volume)} />
        <Stat label="Cap. merc." value={data.marketCap ? `R$ ${fmtCompact(data.marketCap)}` : "—"} />
        <Stat label="Índice P/L" value={pl ?? "—"} />
        <Stat label="Div. Yield" value={dy ?? "—"} />
        <div className="col-span-2">
          <Stat
            label="52 semanas"
            value={
              quote.week52Low != null && quote.week52High != null
                ? `${fmtPreco(quote.week52Low)} – ${fmtPreco(quote.week52High)}`
                : "—"
            }
          />
        </div>
      </div>

      {/* Sensibilidade a fatores exógenos (mecânica preditiva, 20 pregões) */}
      <FatoresSection factors={data.factors ?? []} />

      {/* Bloco 1 — Sobre a empresa */}
      <div className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Sobre a empresa</h3>
        <div className="divide-y">
          <Stat label="Setor" value={data.company?.sector ?? "—"} />
          <Stat label="Subsetor" value={data.company?.subsector ?? "—"} />
          <Stat label="Tipo" value={data.company?.type ?? "—"} />
          <Stat label="Valor de mercado" value={data.marketCap ? `R$ ${fmtCompact(data.marketCap)}` : "—"} />
        </div>
      </div>

      {/* Bloco 2 — Indicadores fundamentalistas */}
      <div className="p-4">
        <h3 className="mb-1 text-sm font-semibold">Indicadores fundamentalistas</h3>
        {data.groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">Indicadores indisponíveis para este ativo.</p>
        ) : (
          <div className="space-y-3">
            {data.groups.map((g) => (
              <div key={g.title}>
                <div className="text-muted-foreground mb-0.5 text-[11px] font-medium uppercase tracking-wide">
                  {g.title}
                </div>
                <div className="divide-y">
                  {g.items.map((it) => {
                    const help = INDICATOR_HELP[it.label];
                    return (
                      <div key={it.label} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                          {it.label}
                          {help && (
                            <HelpPopover label={`O que é ${it.label}?`} title={help.title}>
                              <p>{help.desc}</p>
                            </HelpPopover>
                          )}
                        </span>
                        <span className="text-right text-sm font-medium tabular-nums">{it.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
