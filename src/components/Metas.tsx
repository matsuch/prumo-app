"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getCarteira } from "@/lib/supabase/carteira";
import { getGoals, addGoal, removeGoal, updateGoalAporte, type Goal } from "@/lib/supabase/goals";
import type { FixedIncomePosition } from "@/lib/domain/fixedIncome";
import type { StockPosition } from "@/lib/domain/stocks";
import { formatBRL, formatBRLCents } from "@/lib/domain/currency";
import { MACRO_DEFAULT } from "@/lib/domain/marketAssumptions";
import { buildProjectionInputs, projectFromPortfolio } from "@/lib/domain/portfolioProjection";
import { analyzeGoal, anosAte } from "@/lib/domain/goalPlanning";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import BottomSheet from "./mobile/BottomSheet";
import { MoneyInput } from "./ui/money-input";

export default function Metas() {
  const isMobile = useIsMobile();
  const [fixed, setFixed] = useState<FixedIncomePosition[]>([]);
  const [stocks, setStocks] = useState<StockPosition[]>([]);
  const [fixedValues, setFixedValues] = useState<Record<string, number>>({});
  const [stockValues, setStockValues] = useState<Record<string, number>>({});
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // "Agora" fixado uma vez (evita chamar Date.now() durante o render).
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      try {
        const [c, g] = await Promise.all([getCarteira(), getGoals()]);
        setFixed(c.fixed);
        setStocks(c.stocks);
        setGoals(g);
        if (c.fixed.length || c.stocks.length) {
          const res = await fetch("/api/carteira", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fixedIncome: c.fixed, stocks: c.stocks }),
          });
          const data = await res.json();
          setFixedValues(
            Object.fromEntries(
              (data.fixedResults ?? []).map((r: { id: string; valorAtual: number }) => [
                r.id,
                r.valorAtual,
              ]),
            ),
          );
          setStockValues(
            Object.fromEntries(
              (data.stockResults ?? []).map((r: { id: string; valorAtual: number | null }) => [
                r.id,
                r.valorAtual,
              ]),
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

  // Valor atual por posição, com fallback para o investido.
  const fvals = useMemo(() => {
    const o: Record<string, number> = {};
    for (const p of fixed) o[p.id] = fixedValues[p.id] ?? p.valorAplicado;
    return o;
  }, [fixed, fixedValues]);
  const svals = useMemo(() => {
    const o: Record<string, number> = {};
    for (const s of stocks) o[s.id] = stockValues[s.id] ?? s.quantidade * s.precoCompra;
    return o;
  }, [stocks, stockValues]);

  const patrimonio = useMemo(
    () => buildProjectionInputs(fixed, stocks, fvals, svals, 0, MACRO_DEFAULT).totalValue,
    [fixed, stocks, fvals, svals],
  );

  /** Projeta o patrimônio no fim do prazo (cenário base) para um aporte mensal. */
  function projectBase(anos: number, aporte: number): number {
    const inputs = buildProjectionInputs(fixed, stocks, fvals, svals, aporte, MACRO_DEFAULT);
    const band = projectFromPortfolio(inputs, anos);
    return band.base[band.base.length - 1]?.total ?? patrimonio;
  }

  async function onAdd(g: Omit<Goal, "id">) {
    try {
      const created = await addGoal(g);
      setGoals((prev) => [...prev, created].sort((a, b) => a.dataAlvo.localeCompare(b.dataAlvo)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar meta");
    }
  }
  async function onRemove(id: string) {
    try {
      await removeGoal(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }
  async function onAporte(id: string, aporte: number) {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, aporteMensal: aporte } : g)));
    try {
      await updateGoalAporte(id, aporte);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar aporte");
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const semCarteira = fixed.length === 0 && stocks.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-destructive">⚠ {error}</p>}

      {semCarteira && (
        <div className="rounded-xl border border-dashed border p-6 text-center text-sm text-muted-foreground">
          Cadastre sua carteira para as metas usarem o patrimônio e a projeção reais.{" "}
          <Link href="/cadastro?aba=investimentos" className="text-primary hover:underline">
            Ir para a carteira →
          </Link>
        </div>
      )}

      {!semCarteira && (
        <p className="text-sm text-muted-foreground">
          Patrimônio de partida: <strong>{formatBRLCents(patrimonio)}</strong>. As metas projetam a
          partir daqui (cenário base, valores nominais).
        </p>
      )}

      <div className="space-y-4">
        {goals.map((g) => {
          const anos = anosAte(g.dataAlvo);
          const a = analyzeGoal(g.valorAlvo, anos, patrimonio, g.aporteMensal, (ap) =>
            projectBase(anos, ap),
          );
          const progresso = Math.min(a.progressoHoje * 100, 100);
          const vencida = new Date(`${g.dataAlvo}T00:00:00Z`).getTime() < agora;
          return (
            <div
              key={g.id}
              className="rounded-xl border border bg-card p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{g.nome || "Meta"}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(g.valorAlvo)} até {new Date(g.dataAlvo).toLocaleDateString("pt-BR")}
                    {vencida ? " · prazo vencido" : ` · ${a.anos.toFixed(1)} anos`}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(g.id)}
                  aria-label={`Remover meta ${g.nome || "sem nome"}`}
                  className={cn(
                    "text-muted-foreground hover:text-destructive shrink-0",
                    // No celular o alvo tem 44px; no desktop segue o ✕ discreto.
                    isMobile ? "-mr-2 grid size-11 place-items-center rounded-lg" : "",
                  )}
                  title="Remover"
                >
                  {isMobile ? <Trash2 className="size-5" aria-hidden="true" /> : "✕"}
                </button>
              </div>

              {/* Progresso do patrimônio hoje vs alvo */}
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Progresso hoje</span>
                <span className="tabular-nums">{a.progressoHoje >= 0 ? `${(a.progressoHoje * 100).toFixed(0)}%` : "—"}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(progresso, 2)}%` }}
                />
              </div>

              <div className={cn("mt-4 grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
                <Stat label="Projetado no prazo" value={formatBRL(a.projetado)} accent={a.atinge} />
                <Stat
                  label={a.atinge ? "Status" : "Falta aportar/mês"}
                  value={
                    a.atinge
                      ? "🎯 no caminho"
                      : a.aporteNecessario === Infinity
                        ? "prazo curto demais"
                        : `${formatBRLCents(a.aporteNecessario)}`
                  }
                  positive={a.atinge}
                />
                <label className={cn("text-xs", isMobile && "col-span-2")}>
                  <span className="text-muted-foreground">Meu aporte/mês</span>
                  <div
                    className={cn(
                      "mt-0.5 flex items-center rounded-lg border border px-2",
                      isMobile && "h-11",
                    )}
                  >
                    <span className="text-muted-foreground">R$</span>
                    <MoneyInput
                      value={g.aporteMensal}
                      placeholder="0,00"
                      onChange={(v) => onAporte(g.id, v)}
                      className={cn(
                        "w-full min-w-0 bg-transparent pl-1 tabular-nums outline-none",
                        // 16px no celular: abaixo disso o iOS dá zoom ao focar.
                        isMobile ? "h-full text-base" : "py-1.5 text-sm",
                      )}
                    />
                  </div>
                </label>
              </div>

              {!a.atinge && a.aporteNecessario !== Infinity && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Com {formatBRLCents(a.aporteNecessario)}/mês você projeta atingir{" "}
                  {formatBRL(g.valorAlvo)} em {a.anos.toFixed(1)} anos.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <NovaMeta onAdd={onAdd} mobile={isMobile} />
    </div>
  );
}

function NovaMeta({
  onAdd,
  mobile,
}: {
  onAdd: (g: Omit<Goal, "id">) => void;
  mobile: boolean;
}) {
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [aporte, setAporte] = useState("");
  // No celular o formulário mora em um bottom sheet — a lista fica limpa e o
  // formulário nasce perto do polegar, com o botão salvar fixo acima do teclado.
  const [sheetOpen, setSheetOpen] = useState(false);

  const podeSalvar = Boolean(valor && data);

  function add() {
    if (!podeSalvar) return;
    onAdd({
      nome: nome || "Meta",
      valorAlvo: Number(valor),
      dataAlvo: data,
      aporteMensal: Number(aporte) || 0,
    });
    setNome("");
    setValor("");
    setData("");
    setAporte("");
    setSheetOpen(false);
  }

  const campos = (
    <>
      <Field
        label="Objetivo"
        placeholder="Aposentadoria"
        value={nome}
        onChange={setNome}
        mobile={mobile}
      />
      <Field
        label="Valor alvo"
        placeholder="1000000"
        value={valor}
        onChange={setValor}
        numeric
        mobile={mobile}
      />
      <label className="text-xs">
        <span className="text-muted-foreground">Prazo</span>
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className={cn(
            "mt-0.5 w-full rounded-lg border border bg-transparent px-2 outline-none [color-scheme:light_dark] focus:border-ring",
            mobile ? "h-11 text-base" : "py-1.5 text-sm",
          )}
        />
      </label>
      <Field
        label="Aporte/mês"
        placeholder="500"
        value={aporte}
        onChange={setAporte}
        numeric
        mobile={mobile}
      />
    </>
  );

  if (mobile) {
    return (
      <>
        <button
          onClick={() => setSheetOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
        >
          <Plus className="size-4" aria-hidden="true" /> Nova meta
        </button>

        {sheetOpen && (
          <BottomSheet
            title="Nova meta"
            description="Quanto você quer ter, e até quando."
            onClose={() => setSheetOpen(false)}
            footer={
              <button
                onClick={add}
                disabled={!podeSalvar}
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-full rounded-xl text-sm font-medium disabled:opacity-40"
              >
                Adicionar meta
              </button>
            }
          >
            <div className="space-y-4 pb-2">{campos}</div>
          </BottomSheet>
        )}
      </>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border p-4">
      <h3 className="mb-3 text-sm font-semibold">Nova meta</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{campos}</div>
      <button
        onClick={add}
        className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + Adicionar meta
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  mobile = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  mobile?: boolean;
}) {
  return (
    <label className="text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type={numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-0.5 w-full rounded-lg border border bg-transparent px-2 outline-none focus:border-ring",
          mobile ? "h-11 text-base" : "py-1.5 text-sm",
        )}
      />
    </label>
  );
}

function Stat({
  label,
  value,
  accent,
  positive,
}: {
  label: string;
  value: string;
  accent?: boolean;
  positive?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          accent || positive ? "text-positive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
