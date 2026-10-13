"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCarteira } from "@/lib/supabase/carteira";
import { getSnapshots, saveSnapshot, removeSnapshot, type Snapshot } from "@/lib/supabase/snapshots";
import { getPluggyPositions, type StoredPosition } from "@/lib/supabase/pluggy";
import type { FixedIncomePosition } from "@/lib/domain/fixedIncome";
import type { StockPosition } from "@/lib/domain/stocks";
import { formatBRLCents } from "@/lib/domain/currency";
import { MACRO_DEFAULT } from "@/lib/domain/marketAssumptions";
import { buildProjectionInputs } from "@/lib/domain/portfolioProjection";
import { pluggyToHoldings, pluggyTotalInvested } from "@/lib/domain/pluggyMapping";
import { Button } from "./ui/button";
import HistoryChart, { type HistoryPoint } from "./HistoryChart";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Historico() {
  const isMobile = useIsMobile();
  const [fixed, setFixed] = useState<FixedIncomePosition[]>([]);
  const [stocks, setStocks] = useState<StockPosition[]>([]);
  const [fixedValues, setFixedValues] = useState<Record<string, number>>({});
  const [stockValues, setStockValues] = useState<Record<string, number>>({});
  const [pluggy, setPluggy] = useState<StoredPosition[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [c, snaps, plg] = await Promise.all([
          getCarteira(),
          getSnapshots(),
          getPluggyPositions().catch(() => [] as StoredPosition[]),
        ]);
        setFixed(c.fixed);
        setStocks(c.stocks);
        setPluggy(plg);
        setSnapshots(snaps);
        if (c.fixed.length || c.stocks.length) {
          const res = await fetch("/api/carteira", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fixedIncome: c.fixed, stocks: c.stocks }),
          });
          const data = await res.json();
          setFixedValues(
            Object.fromEntries(
              (data.fixedResults ?? []).map((r: { id: string; valorAtual: number }) => [r.id, r.valorAtual]),
            ),
          );
          setStockValues(
            Object.fromEntries(
              (data.stockResults ?? []).map((r: { id: string; valorAtual: number | null }) => [r.id, r.valorAtual]),
            ),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Números consolidados (inclui Pluggy) para bater com o Dashboard.
  const { patrimonio, investido, porClasse } = useMemo(() => {
    const fvals: Record<string, number> = {};
    for (const p of fixed) fvals[p.id] = fixedValues[p.id] ?? p.valorAplicado;
    const svals: Record<string, number> = {};
    for (const s of stocks) svals[s.id] = stockValues[s.id] ?? s.quantidade * s.precoCompra;
    const inputs = buildProjectionInputs(
      fixed,
      stocks,
      fvals,
      svals,
      0,
      MACRO_DEFAULT,
      pluggyToHoldings(pluggy, MACRO_DEFAULT),
    );
    const inv =
      fixed.reduce((a, p) => a + p.valorAplicado, 0) +
      stocks.reduce((a, p) => a + p.quantidade * p.precoCompra, 0) +
      pluggyTotalInvested(pluggy);
    return { patrimonio: inputs.totalValue, investido: inv, porClasse: inputs.byClassValue };
  }, [fixed, stocks, fixedValues, stockValues, pluggy]);

  const chartData: HistoryPoint[] = useMemo(
    () =>
      snapshots.map((s) => ({
        date: new Date(`${s.data}T00:00:00Z`),
        patrimonio: s.patrimonio,
        investido: s.investido,
      })),
    [snapshots],
  );

  const hoje = hojeISO();
  const jaSalvoHoje = snapshots.some((s) => s.data === hoje);
  const ultimo = snapshots[snapshots.length - 1];
  const deltaUltimo = ultimo ? patrimonio - ultimo.patrimonio : 0;

  async function salvar() {
    setSaving(true);
    setError(null);
    try {
      await saveSnapshot({ data: hoje, patrimonio, investido, porClasse });
      setSnapshots(await getSnapshots());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar snapshot");
    } finally {
      setSaving(false);
    }
  }
  async function excluir(id: string) {
    try {
      await removeSnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const semCarteira = fixed.length === 0 && stocks.length === 0 && pluggy.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-destructive">⚠ {error}</p>}

      {semCarteira ? (
        <div className="rounded-xl border border-dashed border p-6 text-center text-sm text-muted-foreground">
          Cadastre sua carteira para começar a registrar o histórico.{" "}
          <Link href="/cadastro?aba=investimentos" className="text-primary hover:underline">
            Ir para a carteira →
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border bg-card px-4 py-3">
            <span className="text-xs text-muted-foreground">Patrimônio hoje</span>
            <p className="text-lg font-semibold tabular-nums text-primary">
              {formatBRLCents(patrimonio)}
            </p>
          </div>
          {ultimo && (
            <span className="text-xs text-muted-foreground">
              vs último snapshot ({new Date(`${ultimo.data}T00:00:00Z`).toLocaleDateString("pt-BR")}):{" "}
              <strong className={deltaUltimo >= 0 ? "text-positive" : "text-destructive"}>
                {deltaUltimo >= 0 ? "+" : ""}
                {formatBRLCents(deltaUltimo)}
              </strong>
            </span>
          )}
          <Button
            onClick={salvar}
            disabled={saving}
            className={cn("ml-auto", isMobile && "h-11 w-full")}
          >
            {saving ? "…" : jaSalvoHoje ? "Atualizar snapshot de hoje" : "Salvar snapshot de hoje"}
          </Button>
        </div>
      )}

      {chartData.length >= 2 ? (
        <section className="rounded-xl border border bg-card p-5">
          <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 bg-blue-500" /> Patrimônio
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-4 border-t border-dashed border-muted" /> Investido
            </span>
          </div>
          <HistoryChart data={chartData} />
        </section>
      ) : (
        !semCarteira && (
          <p className="text-sm text-muted-foreground">
            Salve snapshots ao longo do tempo (ex.: uma vez por mês) para ver o gráfico da evolução.
          </p>
        )
      )}

      {/* overflow-x-auto: no celular a tabela rola DENTRO do cartão em vez de
          ficar cortada (a página continua sem rolagem horizontal). */}
      {snapshots.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 text-right font-medium">Patrimônio</th>
                <th className="px-3 py-2 text-right font-medium">Investido</th>
                <th className="px-3 py-2 text-right font-medium">Rendimento</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {[...snapshots].reverse().map((s) => (
                <tr key={s.id} className="border-t border">
                  <td className="px-3 py-2">{new Date(`${s.data}T00:00:00Z`).toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRLCents(s.patrimonio)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBRLCents(s.investido)}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${s.patrimonio - s.investido >= 0 ? "text-positive" : "text-destructive"}`}
                  >
                    {formatBRLCents(s.patrimonio - s.investido)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => excluir(s.id)}
                      aria-label="Remover snapshot"
                      // after:-inset-3 amplia o toque sem mexer na largura da coluna.
                      className="text-muted-foreground hover:text-destructive relative after:absolute after:-inset-3 after:content-['']"
                      title="Remover"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
