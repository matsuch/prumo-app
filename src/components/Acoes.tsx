"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import AcoesChart, { type ChartLine } from "./AcoesChart";
import AcaoDetalhe from "./AcaoDetalhe";
import { formatBRLCents } from "@/lib/domain/currency";
import type { TickerSeries } from "@/app/api/acoes/route";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";

// Ação exibida no painel de detalhe quando a página abre (referência inicial).
const DEFAULT_TICKER = "PETR4";

// Paleta legível em tema claro e escuro (uma cor por ticker, por ordem).
const PALETTE = [
  "#2563eb", "#16a34a", "#dc2626", "#d97706", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#ea580c", "#4f46e5",
];

const WINDOWS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "12m", days: 365 },
] as const;

interface Point {
  date: Date;
  close: number;
}

interface Loaded {
  ticker: string;
  color: string;
  points: Point[];
}

/** Retorno % no intervalo dos últimos `days` (do 1º fechamento da janela ao último). */
function returnForDays(points: Point[], days: number): number | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const cutoff = last.date.getTime() - days * 86_400_000;
  const window = points.filter((p) => p.date.getTime() >= cutoff);
  const first = (window.length >= 2 ? window : points)[0];
  if (!first?.close) return null;
  return ((last.close - first.close) / first.close) * 100;
}

/** Série normalizada (variação % desde o 1º ponto) na janela selecionada. */
function toChartLine(s: Loaded, days: number): ChartLine | null {
  const last = s.points[s.points.length - 1];
  if (!last) return null;
  const cutoff = last.date.getTime() - days * 86_400_000;
  const window = s.points.filter((p) => p.date.getTime() >= cutoff);
  const pts = window.length >= 2 ? window : s.points;
  const base = pts[0]?.close;
  if (!base) return null;
  return {
    ticker: s.ticker,
    color: s.color,
    points: pts.map((p) => ({ date: p.date, value: ((p.close - base) / base) * 100 })),
  };
}

/** Busca a watchlist + séries e aplica a paleta (uma cor por ticker, por ordem). */
async function fetchSeries(): Promise<Loaded[]> {
  const res = await fetch("/api/acoes");
  if (!res.ok) throw new Error("Falha ao carregar as ações.");
  const data = (await res.json()) as { series: TickerSeries[] };
  return data.series.map((s, i) => ({
    ticker: s.ticker,
    color: PALETTE[i % PALETTE.length],
    points: s.points.map((p) => ({ date: new Date(p.date), close: p.close })),
  }));
}

function Pct({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  const color = v > 0 ? "text-emerald-600 dark:text-emerald-400" : v < 0 ? "text-red-600 dark:text-red-400" : "";
  return <span className={`tabular-nums ${color}`}>{`${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}</span>;
}

export default function Acoes({ initialTicker }: { initialTicker?: string }) {
  const isMobile = useIsMobile();
  const [series, setSeries] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(90);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(initialTicker || DEFAULT_TICKER);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSeries(await fetchSeries());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial: setState só nas continuações (flag alive), nunca síncrono no effect.
  useEffect(() => {
    let alive = true;
    fetchSeries()
      .then((s) => alive && setSeries(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/acoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível adicionar.");
      setInput("");
      setSelected(ticker); // já abre o detalhe da ação recém-adicionada
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(ticker: string) {
    setSeries((prev) => prev.filter((s) => s.ticker !== ticker)); // otimista
    await fetch(`/api/acoes?ticker=${encodeURIComponent(ticker)}`, { method: "DELETE" });
  }

  const lines = useMemo(
    () => series.map((s) => toChartLine(s, days)).filter((l): l is ChartLine => l !== null),
    [series, days],
  );

  return (
    <div className="space-y-4">
      {/* Barra de controles full-width (vale para as duas colunas) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={add}
          className={cn("flex items-center gap-2", isMobile ? "flex-wrap" : "flex-wrap")}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder={isMobile ? "Ex.: PETR4" : "Adicionar ação (ex.: PETR4, VALE3, ITUB4)"}
            className={cn(isMobile ? "h-11 w-full text-base" : "max-w-xs")}
            aria-label="Código da ação"
          />
          <Button
            type="submit"
            disabled={busy || !input.trim()}
            size="sm"
            className={cn(isMobile && "h-11 flex-1")}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => load()}
            disabled={loading}
            className={cn(isMobile && "h-11 flex-1")}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </form>

        {/* Seletor de janela (vale para os dois gráficos) */}
        <div className={cn("flex items-center gap-1", isMobile && "w-full")}>
          {WINDOWS.map((w) => (
            <Button
              key={w.days}
              variant={days === w.days ? "secondary" : "ghost"}
              size="sm"
              className={cn(isMobile && "h-11 flex-1")}
              onClick={() => setDays(w.days)}
            >
              {w.label}
            </Button>
          ))}
        </div>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Duas colunas alinhadas no topo: à esquerda gráfico + tabela, à direita o detalhe */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px]">
        {/* Coluna esquerda */}
        <div className="min-w-0 space-y-5">
        {/* Gráfico comparativo (variação %) */}
        <div className="bg-card rounded-lg border p-4">
          {loading ? (
            <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
              Carregando cotações…
            </div>
          ) : lines.length === 0 ? (
            <div className="text-muted-foreground flex h-72 flex-col items-center justify-center gap-2 text-sm">
              <TrendingUp className="size-6 opacity-40" />
              Adicione ações acima para acompanhar a evolução.
            </div>
          ) : (
            <>
              <AcoesChart lines={lines} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {lines.map((l) => (
                  <button
                    key={l.ticker}
                    onClick={() => setSelected(l.ticker)}
                    className="flex items-center gap-1.5 text-xs hover:underline"
                  >
                    <span className="inline-block size-2.5 rounded-full" style={{ background: l.color }} />
                    {l.ticker}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tabela de retornos por janela — clicar seleciona o ativo do painel */}
        {series.length > 0 && (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Ação</th>
                  <th className="px-3 py-2 text-right font-medium">Preço</th>
                  <th className="px-3 py-2 text-right font-medium">30d</th>
                  <th className="px-3 py-2 text-right font-medium">60d</th>
                  <th className="px-3 py-2 text-right font-medium">90d</th>
                  <th className="px-3 py-2 text-right font-medium">12m</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => {
                  const last = s.points[s.points.length - 1];
                  const isSel = selected === s.ticker;
                  return (
                    <tr
                      key={s.ticker}
                      onClick={() => setSelected(s.ticker)}
                      aria-selected={isSel}
                      className={`hover:bg-muted/40 cursor-pointer border-t ${isSel ? "bg-secondary" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium">
                        <span className="flex items-center gap-2">
                          <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
                          {s.ticker}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {last ? formatBRLCents(last.close) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right"><Pct v={returnForDays(s.points, 30)} /></td>
                      <td className="px-3 py-2 text-right"><Pct v={returnForDays(s.points, 60)} /></td>
                      <td className="px-3 py-2 text-right"><Pct v={returnForDays(s.points, 90)} /></td>
                      <td className="px-3 py-2 text-right"><Pct v={returnForDays(s.points, 365)} /></td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(s.ticker);
                          }}
                          className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                          aria-label={`Remover ${s.ticker}`}
                        >
                          <X className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Cotações via Yahoo Finance (fechamento diário). Variação normalizada: cada ação parte de 0%
          no início da janela. Informativo, não é recomendação de investimento.
        </p>
      </div>

        {/* Coluna direita: detalhe do ativo selecionado (fixo ao rolar) */}
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <AcaoDetalhe key={selected} ticker={selected} days={days} />
        </aside>
      </div>
    </div>
  );
}
