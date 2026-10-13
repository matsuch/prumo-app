"use client";

import { useEffect, useState } from "react";
import type { FixedIncomePosition, Indexador } from "@/lib/domain/fixedIncome";
import type { StockPosition } from "@/lib/domain/stocks";
import { formatBRLCents } from "@/lib/domain/currency";
import {
  getCarteira,
  addFixed,
  addStock,
  removeFixed,
  removeStock,
} from "@/lib/supabase/carteira";
import { getPluggyPositions, type StoredPosition } from "@/lib/supabase/pluggy";
import {
  getIncomes,
  saveIncome,
  mesRef,
  itensDoMes,
  somaItens,
  type IncomeItem,
  type MonthlyIncome,
} from "@/lib/supabase/income";
import { getGoals, saveGoal, type MonthlyGoal } from "@/lib/supabase/goal";
import {
  getAllExpenses,
  saveMonthExpenses,
  effectiveExpenses,
  expenseStatus,
  type ExpenseRow,
  type ExpenseItem,
} from "@/lib/supabase/expenses";
import { pluggyTotalInvested, pluggyTotalValue } from "@/lib/domain/pluggyMapping";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CandlestickChart,
  Landmark,
  Link2,
  PiggyBank,
  Plus,
  Receipt,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import BottomSheet from "./mobile/BottomSheet";
import { MoneyInput } from "./ui/money-input";

interface FixedResult {
  id: string;
  valorAtual: number;
  rendimento: number;
  rentabilidade: number;
  rentabilidadeAnual: number;
  aliquotaIR: number;
  imposto: number;
  valorLiquido: number;
  rendimentoLiquido: number;
}
interface StockResult {
  id: string;
  shortName?: string;
  precoAtual: number | null;
  valorInvestido: number;
  valorAtual: number | null;
  rendimento: number | null;
  rentabilidade: number | null;
  rentabilidadeAnual: number | null;
}

const uid = () => Math.random().toString(36).slice(2, 9);

const INDEXADORES: { value: Indexador; label: string; hint: string }[] = [
  { value: "CDI", label: "CDI", hint: "% do CDI (ex.: 110)" },
  { value: "IPCA", label: "IPCA+", hint: "spread a.a. (ex.: 6)" },
  { value: "PREFIXADO", label: "Prefixado", hint: "taxa a.a. (ex.: 12)" },
  { value: "SELIC", label: "Selic", hint: "% da Selic (ex.: 100)" },
];

function pct(v: number | null): string {
  return v == null ? "—" : `${(v * 100).toFixed(2).replace(".", ",")}%`;
}

export default function Carteira() {
  const isMobile = useIsMobile();
  const [fixed, setFixed] = useState<FixedIncomePosition[]>([]);
  const [stocks, setStocks] = useState<StockPosition[]>([]);
  const [pluggy, setPluggy] = useState<StoredPosition[]>([]);
  const [fixedRes, setFixedRes] = useState<Record<string, FixedResult>>({});
  const [stockRes, setStockRes] = useState<Record<string, StockResult>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Carrega a carteira do Supabase
  useEffect(() => {
    getCarteira()
      .then(({ fixed, stocks }) => {
        setFixed(fixed);
        setStocks(stocks);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar carteira"));
    getPluggyPositions()
      .then(setPluggy)
      .catch(() => setPluggy([]));
  }, []);

  async function calcular() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/carteira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixedIncome: fixed, stocks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao calcular");
      setFixedRes(Object.fromEntries(data.fixedResults.map((r: FixedResult) => [r.id, r])));
      setStockRes(Object.fromEntries(data.stockResults.map((r: StockResult) => [r.id, r])));
      setUpdatedAt(data.updatedAt);
      setError(data.warnings?.length ? data.warnings.join(" ") : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  const patrimonio =
    Object.values(fixedRes).reduce((s, r) => s + r.valorAtual, 0) +
    Object.values(stockRes).reduce((s, r) => s + (r.valorAtual ?? 0), 0) +
    pluggyTotalValue(pluggy);
  const investido =
    fixed.reduce((s, p) => s + p.valorAplicado, 0) +
    stocks.reduce((s, p) => s + p.quantidade * p.precoCompra, 0) +
    pluggyTotalInvested(pluggy);
  const rendimento = patrimonio - investido;
  const temResultado =
    Object.keys(fixedRes).length + Object.keys(stockRes).length > 0 || pluggy.length > 0;

  return (
    <div className="space-y-8">
      {/* Ação principal: o cálculo usa cotações/índices do dia, por isso é sob demanda. */}
      <div
        className={cn(
          "bg-card gap-3 rounded-xl border p-4",
          isMobile ? "space-y-2" : "flex flex-wrap items-center",
        )}
      >
        <div className={cn("min-w-0", !isMobile && "mr-auto")}>
          <p className="text-sm font-medium">Rentabilidade da carteira</p>
          <p className="text-muted-foreground text-xs">
            {updatedAt
              ? `Atualizado ${new Date(updatedAt).toLocaleString("pt-BR")}`
              : "Renda fixa com CDI/IPCA/Selic do Banco Central; ações e FIIs com a cotação atual."}
          </p>
        </div>
        {error && <span className="text-xs text-destructive">⚠ {error}</span>}
        <button
          onClick={calcular}
          disabled={loading || (fixed.length === 0 && stocks.length === 0)}
          className={cn(
            "rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40",
            isMobile ? "h-12 w-full rounded-xl text-sm" : "px-4 py-2 text-sm",
          )}
        >
          {loading ? "Calculando…" : "Calcular rentabilidade"}
        </button>
      </div>

      {temResultado && (
        <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-3")}>
          <Stat label="Patrimônio hoje" value={formatBRLCents(patrimonio)} accent />
          <Stat label="Total investido" value={formatBRLCents(investido)} />
          <Stat
            label="Rendimento"
            value={formatBRLCents(rendimento)}
            positive={rendimento >= 0}
          />
        </div>
      )}

      <FixedIncomeSection
        mobile={isMobile}
        positions={fixed}
        results={fixedRes}
        onAdd={async (p) => {
          try {
            const created = await addFixed(p);
            setFixed((prev) => [...prev, created]);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erro ao salvar");
          }
        }}
        onRemove={async (id) => {
          try {
            await removeFixed(id);
            setFixed((prev) => prev.filter((p) => p.id !== id));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erro ao remover");
          }
        }}
      />

      <StocksSection
        mobile={isMobile}
        positions={stocks}
        results={stockRes}
        onAdd={async (p) => {
          try {
            const created = await addStock(p);
            setStocks((prev) => [...prev, created]);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erro ao salvar");
          }
        }}
        onRemove={async (id) => {
          try {
            await removeStock(id);
            setStocks((prev) => prev.filter((p) => p.id !== id));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Erro ao remover");
          }
        }}
      />

      {pluggy.length > 0 && <PluggySection positions={pluggy} mobile={isMobile} />}
    </div>
  );
}

/* ---------------- Aba "Mês": entrada, meta e gastos fixos ---------------- */

/**
 * O orçamento do mês. Entrada e Meta são um valor por mês cada (formulários curtos,
 * empilhados à esquerda); os Gastos fixos são uma lista que cresce, e ganham a
 * coluna mais larga à direita — no celular tudo vira uma coluna só.
 */
export function CadastroMes() {
  const isMobile = useIsMobile();
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* grid-cols-1 = minmax(0,1fr): os cards da esquerda ficam presos à largura
          da coluna em vez de crescer até o tamanho intrínseco dos inputs e invadir
          a coluna dos Gastos fixos. */}
      <div className="grid min-w-0 grid-cols-1 gap-4">
        <EntradaMesSection mobile={isMobile} />
        <MetaMesSection mobile={isMobile} />
      </div>
      <GastosFixosSection mobile={isMobile} />
    </div>
  );
}

/* ---------------- Entrada do mês (renda) ---------------- */

function EntradaMesSection({ mobile }: { mobile: boolean }) {
  const [mes, setMes] = useState(() => mesRef().slice(0, 7)); // yyyy-mm (input month)
  const [itens, setItens] = useState<IncomeItem[]>([]);
  const [incomes, setIncomes] = useState<MonthlyIncome[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getIncomes()
      .then((list) => {
        setIncomes(list);
        setItens(linhasOuVazia(itensDoMes(list, `${mes}-01`)));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sempre ao menos uma linha para digitar.
  function linhasOuVazia(list: IncomeItem[]): IncomeItem[] {
    return list.length ? list : [{ descricao: "", valor: 0 }];
  }

  function onMes(m: string) {
    setMes(m);
    setItens(linhasOuVazia(itensDoMes(incomes, `${m}-01`)));
    setMsg(null);
  }
  function update(i: number, patch: Partial<IncomeItem>) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    setMsg(null);
  }
  function addRow() {
    setItens((prev) => [...prev, { descricao: "", valor: 0 }]);
  }
  function removeRow(i: number) {
    setItens((prev) => linhasOuVazia(prev.filter((_, idx) => idx !== i)));
    setMsg(null);
  }

  async function salvar() {
    setSaving(true);
    setMsg(null);
    try {
      const mesISO = `${mes}-01`;
      await saveIncome(mesISO, itens);
      const list = await getIncomes();
      setIncomes(list);
      setItens(linhasOuVazia(itensDoMes(list, mesISO)));
      setMsg("Salvo ✓");
    } catch {
      setMsg("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const total = somaItens(itens);

  return (
    <section className="rounded-xl border bg-card p-4">
      <div
        className={cn(
          "mb-1 gap-2",
          mobile ? "space-y-0.5" : "flex items-baseline justify-between",
        )}
      >
        <SectionTitle icon={Banknote}>Entrada do mês</SectionTitle>
        <span className="text-muted-foreground block text-xs tabular-nums">
          total {formatBRLCents(total)}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Salário e demais rendas que entram no mês, uma por linha. O total aparece como KPI no
        dashboard. O mês novo repete o último salvo.
      </p>

      <label className="mb-3 block text-xs">
        <span className="text-muted-foreground">Mês</span>
        <input
          type="month"
          value={mes}
          onChange={(e) => onMes(e.target.value)}
          className={cn(
            "mt-0.5 block rounded-md border border-input bg-transparent px-2 outline-none [color-scheme:light_dark] focus:border-ring",
            mobile ? "h-11 w-full text-base" : "py-1.5 text-sm",
          )}
        />
      </label>

      <div className={cn(mobile ? "space-y-3" : "space-y-2")}>
        {itens.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={it.descricao}
              placeholder="Descrição (ex.: Salário)"
              aria-label="Descrição da entrada"
              onChange={(e) => update(i, { descricao: e.target.value })}
              className={cn(
                "min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 outline-none focus:border-ring",
                mobile ? "h-11 text-base" : "py-1.5 text-sm",
              )}
            />
            <div
              className={cn(
                "flex shrink-0 items-center rounded-md border border-input px-2",
                mobile && "h-11 w-36",
              )}
            >
              <span className="text-muted-foreground text-sm">R$</span>
              <MoneyInput
                value={it.valor}
                placeholder="0,00"
                aria-label={`Valor de ${it.descricao || "entrada"}`}
                onChange={(v) => update(i, { valor: v })}
                className={cn(
                  "bg-transparent pl-1 tabular-nums outline-none",
                  mobile ? "h-full w-full min-w-0 text-base" : "w-24 py-1.5 text-sm",
                )}
              />
            </div>
            <Remove onClick={() => removeRow(i)} mobile={mobile} label={it.descricao || "entrada"} />
          </div>
        ))}
      </div>

      <div className={cn("mt-3 gap-3", mobile ? "space-y-2" : "flex flex-wrap items-center")}>
        <button
          onClick={addRow}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border border-input font-medium hover:bg-secondary",
            mobile ? "h-11 w-full rounded-xl text-sm" : "px-3 py-1.5 text-xs",
          )}
        >
          <Plus className={mobile ? "size-4" : "size-3.5"} aria-hidden="true" />
          Adicionar entrada
        </button>
        <button
          onClick={salvar}
          disabled={saving}
          className={cn(
            "rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
            mobile ? "h-12 w-full rounded-xl text-sm" : "px-4 py-2 text-sm",
          )}
        >
          {saving ? "…" : "Salvar"}
        </button>
        {msg && (
          <span
            className={cn(
              msg.startsWith("Erro") ? "text-xs text-destructive" : "text-xs text-positive",
              mobile && "block text-center",
            )}
          >
            {msg}
          </span>
        )}
      </div>
    </section>
  );
}

/* ---------------- Meta do mês (o que guardar/investir) ---------------- */

function MetaMesSection({ mobile }: { mobile: boolean }) {
  const [mes, setMes] = useState(() => mesRef().slice(0, 7)); // yyyy-mm
  const [valor, setValor] = useState("");
  const [goals, setGoals] = useState<MonthlyGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getGoals()
      .then((list) => {
        setGoals(list);
        const found = list.find((g) => g.mes === `${mes}-01`);
        if (found) setValor(String(found.valor));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMes(m: string) {
    setMes(m);
    const found = goals.find((g) => g.mes === `${m}-01`);
    setValor(found ? String(found.valor) : "");
    setMsg(null);
  }

  async function salvar() {
    setSaving(true);
    setMsg(null);
    try {
      await saveGoal(`${mes}-01`, Number(valor) || 0);
      setGoals(await getGoals());
      setMsg("Salvo ✓");
    } catch {
      setMsg("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <SectionTitle icon={PiggyBank} className="mb-1">Meta do mês</SectionTitle>
      <p className="mb-3 text-xs text-muted-foreground">
        Quanto você planeja guardar/investir neste mês. Desconta da Sobra no Fluxo do mês.
      </p>
      <MesValorForm
        mobile={mobile}
        mes={mes}
        onMes={onMes}
        valor={valor}
        onValor={setValor}
        placeholder="1.000,00"
        saving={saving}
        msg={msg}
        onSalvar={salvar}
      />
    </section>
  );
}

/* Formulário "mês + valor + salvar", usado pela Meta do mês.
   No celular os campos ocupam a linha toda (44px de altura, fonte de 16px para
   o iOS não dar zoom) e o botão de salvar fica com a largura inteira. */
function MesValorForm({
  mobile,
  mes,
  onMes,
  valor,
  onValor,
  placeholder,
  saving,
  msg,
  onSalvar,
}: {
  mobile: boolean;
  mes: string;
  onMes: (m: string) => void;
  valor: string;
  onValor: (v: string) => void;
  placeholder: string;
  saving: boolean;
  msg: string | null;
  onSalvar: () => void;
}) {
  return (
    <div className={cn("gap-3", mobile ? "space-y-3" : "flex flex-wrap items-end")}>
      <label className={cn("text-xs", mobile && "block")}>
        <span className="text-muted-foreground">Mês</span>
        <input
          type="month"
          value={mes}
          onChange={(e) => onMes(e.target.value)}
          className={cn(
            "mt-0.5 block rounded-md border border-input bg-transparent px-2 outline-none [color-scheme:light_dark] focus:border-ring",
            mobile ? "h-11 w-full text-base" : "py-1.5 text-sm",
          )}
        />
      </label>
      <label className={cn("text-xs", mobile && "block")}>
        <span className="text-muted-foreground">Valor</span>
        <div
          className={cn(
            "mt-0.5 flex items-center rounded-md border border-input px-2",
            mobile && "h-11",
          )}
        >
          <span className="text-muted-foreground text-sm">R$</span>
          <MoneyInput
            value={Number(valor) || 0}
            onChange={(v) => onValor(v ? String(v) : "")}
            placeholder={placeholder}
            className={cn(
              "bg-transparent pl-1 tabular-nums outline-none",
              mobile ? "h-full w-full min-w-0 text-base" : "w-28 py-1.5 text-sm",
            )}
          />
        </div>
      </label>
      <button
        onClick={onSalvar}
        disabled={saving}
        className={cn(
          "rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
          mobile ? "h-12 w-full rounded-xl text-sm" : "px-4 py-2 text-sm",
        )}
      >
        {saving ? "…" : "Salvar"}
      </button>
      {msg && (
        <span className={cn("text-xs text-positive", mobile && "block text-center")}>{msg}</span>
      )}
    </div>
  );
}

/* ---------------- Gastos fixos (por mês, com carry-over) ---------------- */

// Converte a lista efetiva de um mês em itens editáveis. Em carry-over (mês sem
// lista própria), o "pago" começa em 0 — pagamentos não se herdam do mês anterior.
function expensesToItems(rows: ExpenseRow[], mesISO: string): ExpenseItem[] {
  const eff = effectiveExpenses(rows, mesISO);
  const carried = eff.length > 0 && eff[0].mes !== mesISO;
  return eff.map((r) => ({ nome: r.nome, valor: r.valor, pago: carried ? 0 : r.pago }));
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "text-destructive" },
  parcial: { label: "Parcial", cls: "text-amber-600 dark:text-amber-500" },
  pago: { label: "Pago", cls: "text-positive" },
};

function GastosFixosSection({ mobile }: { mobile: boolean }) {
  const [all, setAll] = useState<ExpenseRow[]>([]);
  const [mes, setMes] = useState(() => mesRef().slice(0, 7)); // yyyy-mm
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getAllExpenses()
      .then((rows) => {
        setAll(rows);
        setItems(expensesToItems(rows, `${mes}-01`));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMes(m: string) {
    setMes(m);
    setItems(expensesToItems(all, `${m}-01`));
    setMsg(null);
  }
  function update(i: number, patch: Partial<ExpenseItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    setMsg(null);
  }
  function addRow() {
    setItems((prev) => [...prev, { nome: "", valor: 0, pago: 0 }]);
  }
  function removeRow(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setMsg(null);
  }

  async function salvar() {
    setSaving(true);
    setMsg(null);
    try {
      const mesISO = `${mes}-01`;
      await saveMonthExpenses(mesISO, items);
      const rows = await getAllExpenses();
      setAll(rows);
      setItems(expensesToItems(rows, mesISO));
      setMsg("Salvo ✓");
    } catch {
      setMsg("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const previstoTotal = items.reduce((s, i) => s + (Number(i.valor) || 0), 0);
  const pagoTotal = items.reduce((s, i) => s + Math.max(Number(i.pago) || 0, 0), 0);
  const pendenteTotal = items.reduce(
    (s, i) => s + Math.max((Number(i.valor) || 0) - (Number(i.pago) || 0), 0),
    0,
  );

  return (
    <section className="rounded-xl border bg-card p-4">
      <div
        className={cn(
          "mb-1 gap-2",
          mobile ? "space-y-0.5" : "flex items-baseline justify-between",
        )}
      >
        <SectionTitle icon={Receipt}>Gastos fixos</SectionTitle>
        <span className="text-muted-foreground block text-xs tabular-nums">
          prev {formatBRLCents(previstoTotal)} · pago {formatBRLCents(pagoTotal)} · falta{" "}
          {formatBRLCents(pendenteTotal)}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Por mês. O mês novo repete o último salvo — edite o que variar. Informe o{" "}
        <span className="text-foreground font-medium">Pago</span> para acompanhar o que já saiu
        (pode registrar aos poucos, ex.: diarista).
      </p>

      <label className="mb-3 block text-xs">
        <span className="text-muted-foreground">Mês</span>
        <input
          type="month"
          value={mes}
          onChange={(e) => onMes(e.target.value)}
          className={cn(
            "mt-0.5 block rounded-md border border-input bg-transparent px-2 outline-none [color-scheme:light_dark] focus:border-ring",
            mobile ? "h-11 w-full text-base" : "py-1.5 text-sm",
          )}
        />
      </label>

      <div
        className={cn(
          mobile
            ? "space-y-3"
            : "grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] items-center gap-x-2 gap-y-2",
        )}
      >
        {!mobile && items.length > 0 && (
          // Cabeçalho das colunas: os rótulos saem de dentro dos campos, que assim
          // cabem numa linha só junto com o status.
          <div className="text-muted-foreground contents text-[10px] font-medium tracking-wide uppercase">
            <span>Nome</span>
            <span>Previsto</span>
            <span>Pago</span>
            <span className="text-right">Status</span>
            <span aria-hidden="true" />
          </div>
        )}
        {items.map((it, i) => {
          const previsto = Number(it.valor) || 0;
          const pago = Math.max(Number(it.pago) || 0, 0);
          const pendente = Math.max(previsto - pago, 0);
          const meta = STATUS_META[expenseStatus(previsto, pago)];
          const status =
            pendente > 0 && pago > 0 ? `falta ${formatBRLCents(pendente)}` : meta.label;

          if (mobile) {
            // Cartão por gasto: nome na linha toda, Previsto e Pago lado a lado,
            // status e remover embaixo — nada espremido, tudo com alvo de toque.
            return (
              <div key={i} className="rounded-lg border border-input p-3">
                <input
                  value={it.nome}
                  placeholder="Nome do gasto"
                  aria-label="Nome do gasto"
                  onChange={(e) => update(i, { nome: e.target.value })}
                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base outline-none focus:border-ring"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <MoneyField
                    label="Previsto"
                    value={it.valor}
                    onChange={(v) => update(i, { valor: v })}
                    mobile
                  />
                  <MoneyField
                    label="Pago"
                    value={it.pago}
                    onChange={(v) => update(i, { pago: v })}
                    mobile
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium tabular-nums ${meta.cls}`}>{status}</span>
                  <Remove onClick={() => removeRow(i)} mobile label={it.nome || "gasto"} />
                </div>
              </div>
            );
          }

          return (
            // `contents`: as células entram direto no grid da lista, então todas as
            // linhas compartilham as mesmas colunas e o status fica sempre na linha.
            <div key={i} className="contents">
              <input
                value={it.nome}
                placeholder="Nome"
                aria-label="Nome do gasto"
                onChange={(e) => update(i, { nome: e.target.value })}
                className="w-full min-w-0 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring"
              />
              <MoneyField
                label="Previsto"
                value={it.valor}
                onChange={(v) => update(i, { valor: v })}
              />
              <MoneyField label="Pago" value={it.pago} onChange={(v) => update(i, { pago: v })} />
              <span
                className={`text-right text-[11px] font-medium whitespace-nowrap tabular-nums ${meta.cls}`}
                title={`${meta.label}${pendente > 0 ? ` · falta ${formatBRLCents(pendente)}` : ""}`}
              >
                {status}
              </span>
              <Remove onClick={() => removeRow(i)} />
            </div>
          );
        })}
      </div>

      <div className={cn("mt-3 gap-3", mobile ? "space-y-2" : "flex flex-wrap items-center")}>
        <button
          onClick={addRow}
          className={cn(
            "rounded-lg border border-input font-medium hover:bg-secondary",
            mobile
              ? "flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm"
              : "px-3 py-1.5 text-xs",
          )}
        >
          {mobile && <Plus className="size-4" aria-hidden="true" />}
          {mobile ? "Adicionar gasto" : "+ Linha"}
        </button>
        <button
          onClick={salvar}
          disabled={saving}
          className={cn(
            "rounded-lg bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
            mobile ? "h-12 w-full rounded-xl text-sm" : "px-4 py-2 text-sm",
          )}
        >
          {saving ? "…" : "Salvar mês"}
        </button>
        {msg && (
          <span
            className={cn(
              msg.startsWith("Erro") ? "text-xs text-destructive" : "text-xs text-positive",
              mobile && "block text-center",
            )}
          >
            {msg}
          </span>
        )}
      </div>
    </section>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  mobile = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  mobile?: boolean;
}) {
  if (mobile) {
    // No celular o rótulo fica ACIMA do campo: cabe inteiro e o campo ganha
    // a largura da coluna.
    return (
      <label className="block text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="mt-0.5 flex h-11 items-center rounded-md border border-input px-2">
          <span className="text-muted-foreground text-sm">R$</span>
          <MoneyInput
            value={value}
            placeholder="0,00"
            aria-label={`${label} do gasto`}
            onChange={onChange}
            className="h-full w-full min-w-0 bg-transparent pl-1 text-base tabular-nums outline-none"
          />
        </div>
      </label>
    );
  }

  return (
    <label className="flex items-center rounded-md border border-input px-2" title={label}>
      <span className="text-muted-foreground text-sm">R$</span>
      <MoneyInput
        value={value}
        placeholder="0,00"
        aria-label={`${label} do gasto`}
        onChange={onChange}
        className="w-20 bg-transparent py-1.5 pl-1 text-sm tabular-nums outline-none"
      />
    </label>
  );
}

/* ---------------- Pluggy (Open Finance) ---------------- */

function PluggySection({ positions, mobile }: { positions: StoredPosition[]; mobile: boolean }) {
  const grupos = new Map<string, StoredPosition[]>();
  for (const p of positions) {
    const atual = grupos.get(p.categoria) ?? [];
    atual.push(p);
    grupos.set(p.categoria, atual);
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Link2 className="text-muted-foreground size-4" aria-hidden="true" />
        Open Finance (Pluggy)
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40">
          sincronizado
        </span>
      </h2>

      {mobile ? (
        <div className="space-y-3">
          {[...grupos.entries()].flatMap(([categoria, itens]) =>
            itens.map((p) => (
              <article
                key={`${p.itemId}:${p.externalId}`}
                className="rounded-xl border bg-card p-4"
              >
                <h3 className="text-sm font-semibold">{p.nome}</h3>
                <p className="text-muted-foreground text-xs">{categoria}</p>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  <CardStat label="Investido" value={formatBRLCents(p.valorInvestido)} />
                  <CardStat label="Valor hoje" value={formatBRLCents(p.valorAtual)} />
                  <CardStat
                    label="Rendimento"
                    value={formatBRLCents(p.rendimento)}
                    positive={p.rendimento >= 0}
                  />
                </dl>
              </article>
            )),
          )}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-xl border border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <Th>Ativo</Th>
              <Th>Categoria</Th>
              <Th right>Investido</Th>
              <Th right>Valor hoje</Th>
              <Th right>Rend.</Th>
            </tr>
          </thead>
          <tbody>
            {[...grupos.entries()].flatMap(([categoria, itens]) =>
              itens.map((p) => (
                <tr
                  key={`${p.itemId}:${p.externalId}`}
                  className="border-t border"
                >
                  <Td>{p.nome}</Td>
                  <Td>{categoria}</Td>
                  <Td right>{formatBRLCents(p.valorInvestido)}</Td>
                  <Td right>{formatBRLCents(p.valorAtual)}</Td>
                  <Td right positive={p.rendimento >= 0}>
                    {formatBRLCents(p.rendimento)}
                  </Td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Valores marcados a mercado pelo próprio Pluggy. Já somados nos totais acima e na projeção do
        dashboard. Sincronize em{" "}
        <a href="/conectar" className="text-primary hover:underline">
          Conectar
        </a>
        .
      </p>
    </section>
  );
}

/* ---------------- Renda Fixa ---------------- */

function FixedIncomeSection({
  positions,
  results,
  onAdd,
  onRemove,
  mobile,
}: {
  positions: FixedIncomePosition[];
  results: Record<string, FixedResult>;
  onAdd: (p: FixedIncomePosition) => void;
  onRemove: (id: string) => void;
  mobile: boolean;
}) {
  const [emissor, setEmissor] = useState("");
  const [indexador, setIndexador] = useState<Indexador>("CDI");
  const [taxa, setTaxa] = useState("110");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("");
  const [isento, setIsento] = useState(false);
  // No celular o formulário vive em um bottom sheet — a tabela de 9 colunas do
  // desktop não cabe, e uma "linha de adição" dentro dela seria impossível de usar.
  const [sheetOpen, setSheetOpen] = useState(false);

  const hint = INDEXADORES.find((i) => i.value === indexador)?.hint ?? "";

  function add() {
    if (!valor || !data) return;
    onAdd({
      id: uid(),
      emissor: emissor || "Sem nome",
      indexador,
      taxa: Number(taxa),
      valorAplicado: Number(valor),
      dataAplicacao: data,
      isento,
    });
    setEmissor("");
    setValor("");
    setIsento(false);
    setSheetOpen(false);
  }

  if (mobile) {
    return (
      <section>
        <SectionTitle icon={Landmark} className="mb-3">Renda fixa</SectionTitle>

        {positions.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
            Nenhum título cadastrado.
          </p>
        ) : (
          <div className="space-y-3">
            {positions.map((p) => {
              const r = results[p.id];
              const taxa =
                p.indexador === "IPCA"
                  ? `IPCA + ${p.taxa}%`
                  : p.indexador === "PREFIXADO"
                    ? `${p.taxa}% a.a.`
                    : `${p.taxa}% ${p.indexador}`;
              return (
                <article key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {p.emissor}
                        {p.isento && (
                          <span className="ml-1.5 rounded bg-emerald-100 px-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            isento
                          </span>
                        )}
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        {taxa} · desde {new Date(p.dataAplicacao).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Remove onClick={() => onRemove(p.id)} mobile label={p.emissor} />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                    <CardStat label="Aplicado" value={formatBRLCents(p.valorAplicado)} />
                    <CardStat label="Valor hoje" value={r ? formatBRLCents(r.valorAtual) : "—"} />
                    <CardStat
                      label="Líquido (após IR)"
                      value={r ? formatBRLCents(r.valorLiquido) : "—"}
                      positive={r ? r.rendimentoLiquido >= 0 : undefined}
                    />
                    <CardStat label="% a.a." value={r ? pct(r.rentabilidadeAnual) : "—"} />
                  </dl>

                  {r && r.imposto > 0 && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      IR previsto{" "}
                      <span className="text-destructive tabular-nums">
                        −{formatBRLCents(r.imposto)}
                      </span>{" "}
                      ({(r.aliquotaIR * 100).toFixed(1).replace(".", ",")}%)
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setSheetOpen(true)}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-input text-sm font-medium hover:bg-secondary"
        >
          <Plus className="size-4" aria-hidden="true" /> Adicionar título
        </button>

        {sheetOpen && (
          <BottomSheet
            title="Novo título de renda fixa"
            description="CDB, LCI, LCA, Tesouro — o que você aplicou."
            onClose={() => setSheetOpen(false)}
            footer={
              <button
                onClick={add}
                disabled={!valor || !data}
                className="h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Adicionar título
              </button>
            }
          >
            <div className="space-y-4 pb-2">
              <SheetField label="Emissor">
                <input
                  value={emissor}
                  onChange={(e) => setEmissor(e.target.value)}
                  placeholder="CDB Banco X"
                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base outline-none focus:border-ring"
                />
              </SheetField>

              <SheetField label="Indexador">
                <select
                  value={indexador}
                  onChange={(e) => setIndexador(e.target.value as Indexador)}
                  className="h-11 w-full rounded-md border border-input bg-card px-2 text-base text-foreground outline-none [color-scheme:light_dark]"
                >
                  {INDEXADORES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </SheetField>

              <SheetField label="Taxa" hint={hint}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={taxa}
                  onChange={(e) => setTaxa(e.target.value)}
                  placeholder="110"
                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base tabular-nums outline-none focus:border-ring"
                />
              </SheetField>

              <SheetField label="Valor aplicado">
                <div className="flex h-11 items-center rounded-md border border-input px-2">
                  <span className="text-muted-foreground text-sm">R$</span>
                  <MoneyInput
                    value={Number(valor) || 0}
                    onChange={(v) => setValor(v ? String(v) : "")}
                    placeholder="10.000,00"
                    className="h-full w-full min-w-0 bg-transparent pl-1 text-base tabular-nums outline-none"
                  />
                </div>
              </SheetField>

              <SheetField label="Data da aplicação">
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base text-foreground outline-none [color-scheme:light_dark] focus:border-ring"
                />
              </SheetField>

              <label className="flex min-h-11 items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={isento}
                  onChange={(e) => setIsento(e.target.checked)}
                  className="size-5 accent-emerald-600"
                />
                Isento de IR (LCI/LCA)
              </label>
            </div>
          </BottomSheet>
        )}
      </section>
    );
  }

  return (
    <section>
      <SectionTitle icon={Landmark} className="mb-3">Renda fixa</SectionTitle>

      <div className="overflow-x-auto rounded-xl border border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <Th>Emissor</Th>
              <Th>Indexador</Th>
              <Th>Aplicado</Th>
              <Th>Desde</Th>
              <Th right>Valor hoje</Th>
              <Th right>IR</Th>
              <Th right>Líquido</Th>
              <Th right>% a.a.</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const r = results[p.id];
              return (
                <tr key={p.id} className="border-t border">
                  <Td>
                    {p.emissor}
                    {p.isento && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 text-[10px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        isento
                      </span>
                    )}
                  </Td>
                  <Td>
                    {p.indexador === "IPCA"
                      ? `IPCA + ${p.taxa}%`
                      : p.indexador === "PREFIXADO"
                        ? `${p.taxa}% a.a.`
                        : `${p.taxa}% ${p.indexador}`}
                  </Td>
                  <Td>{formatBRLCents(p.valorAplicado)}</Td>
                  <Td>{new Date(p.dataAplicacao).toLocaleDateString("pt-BR")}</Td>
                  <Td right>{r ? formatBRLCents(r.valorAtual) : "—"}</Td>
                  <Td right>
                    {!r ? (
                      "—"
                    ) : r.imposto > 0 ? (
                      <span className="text-destructive">
                        −{formatBRLCents(r.imposto)}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          {(r.aliquotaIR * 100).toFixed(1).replace(".", ",")}%
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td right positive={r ? r.rendimentoLiquido >= 0 : undefined}>
                    {r ? formatBRLCents(r.valorLiquido) : "—"}
                  </Td>
                  <Td right>{r ? pct(r.rentabilidadeAnual) : "—"}</Td>
                  <Td>
                    <Remove onClick={() => onRemove(p.id)} />
                  </Td>
                </tr>
              );
            })}
            {/* Linha de adição */}
            <tr className="border-t border bg-secondary">
              <Td>
                <Input placeholder="CDB Banco X" value={emissor} onChange={setEmissor} />
              </Td>
              <Td>
                <select
                  value={indexador}
                  onChange={(e) => setIndexador(e.target.value as Indexador)}
                  className="rounded border border bg-card px-1 py-1 text-xs text-foreground [color-scheme:light_dark]"
                >
                  {INDEXADORES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
                <div className="mt-1 flex items-center gap-1">
                  <Input placeholder="taxa" value={taxa} onChange={setTaxa} width="w-14" />
                  <span className="text-[10px] text-muted-foreground">{hint}</span>
                </div>
              </Td>
              <Td>
                <MoneyInput
                  placeholder="10.000,00"
                  aria-label="Valor aplicado"
                  value={Number(valor) || 0}
                  onChange={(v) => setValor(v ? String(v) : "")}
                  className="w-24 rounded border border bg-transparent px-2 py-1 text-xs tabular-nums outline-none focus:border-ring"
                />
              </Td>
              <Td>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="rounded border border bg-card px-1 py-1 text-xs text-foreground [color-scheme:light_dark]"
                />
              </Td>
              <Td colSpan={5}>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isento}
                      onChange={(e) => setIsento(e.target.checked)}
                      className="accent-emerald-600"
                    />
                    Isento (LCI/LCA)
                  </label>
                  <button
                    onClick={add}
                    className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    + Adicionar
                  </button>
                </div>
              </Td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- Ações / FIIs ---------------- */

function StocksSection({
  positions,
  results,
  onAdd,
  onRemove,
  mobile,
}: {
  positions: StockPosition[];
  results: Record<string, StockResult>;
  onAdd: (p: StockPosition) => void;
  onRemove: (id: string) => void;
  mobile: boolean;
}) {
  const [ticker, setTicker] = useState("");
  const [qtd, setQtd] = useState("");
  const [preco, setPreco] = useState("");
  const [data, setData] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  function add() {
    if (!ticker || !qtd || !preco) return;
    onAdd({
      id: uid(),
      ticker: ticker.toUpperCase(),
      quantidade: Number(qtd),
      precoCompra: Number(preco),
      dataCompra: data || new Date().toISOString().slice(0, 10),
    });
    setTicker("");
    setQtd("");
    setPreco("");
    setSheetOpen(false);
  }

  if (mobile) {
    return (
      <section>
        <SectionTitle icon={CandlestickChart} className="mb-3">Ações / FIIs</SectionTitle>

        {positions.length === 0 ? (
          <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-center text-sm">
            Nenhuma posição cadastrada.
          </p>
        ) : (
          <div className="space-y-3">
            {positions.map((p) => {
              const r = results[p.id];
              return (
                <article key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{p.ticker}</h3>
                      <p className="text-muted-foreground truncate text-xs">
                        {p.quantidade} cota{p.quantidade === 1 ? "" : "s"}
                        {r?.shortName ? ` · ${r.shortName}` : ""}
                      </p>
                    </div>
                    <Remove onClick={() => onRemove(p.id)} mobile label={p.ticker} />
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                    <CardStat label="Preço de compra" value={formatBRLCents(p.precoCompra)} />
                    <CardStat
                      label="Preço atual"
                      value={r?.precoAtual != null ? formatBRLCents(r.precoAtual) : "—"}
                    />
                    <CardStat
                      label="Valor hoje"
                      value={r?.valorAtual != null ? formatBRLCents(r.valorAtual) : "—"}
                    />
                    <CardStat
                      label="Rendimento"
                      value={
                        r?.rendimento != null
                          ? `${formatBRLCents(r.rendimento)} · ${pct(r.rentabilidade ?? null)}`
                          : "—"
                      }
                      positive={r?.rendimento != null ? r.rendimento >= 0 : undefined}
                    />
                  </dl>
                </article>
              );
            })}
          </div>
        )}

        <button
          onClick={() => setSheetOpen(true)}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-input text-sm font-medium hover:bg-secondary"
        >
          <Plus className="size-4" aria-hidden="true" /> Adicionar ação ou FII
        </button>

        <p className="text-muted-foreground mt-2 text-xs">
          Preço de compra é o que você pagou (preço médio). A cotação atual vem da brapi.dev.
        </p>

        {sheetOpen && (
          <BottomSheet
            title="Nova posição"
            description="Ação ou FII da B3, pelo ticker."
            onClose={() => setSheetOpen(false)}
            footer={
              <button
                onClick={add}
                disabled={!ticker || !qtd || !preco}
                className="h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                Adicionar posição
              </button>
            }
          >
            <div className="space-y-4 pb-2">
              <SheetField label="Ticker">
                <input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="PETR4"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base uppercase outline-none focus:border-ring"
                />
              </SheetField>

              <div className="grid grid-cols-2 gap-3">
                <SheetField label="Quantidade">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={qtd}
                    onChange={(e) => setQtd(e.target.value)}
                    placeholder="100"
                    className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base tabular-nums outline-none focus:border-ring"
                  />
                </SheetField>
                <SheetField label="Preço de compra">
                  <div className="flex h-11 items-center rounded-md border border-input px-2">
                    <span className="text-muted-foreground text-sm">R$</span>
                    <MoneyInput
                      value={Number(preco) || 0}
                      onChange={(v) => setPreco(v ? String(v) : "")}
                      placeholder="30,50"
                      className="h-full w-full min-w-0 bg-transparent pl-1 text-base tabular-nums outline-none"
                    />
                  </div>
                </SheetField>
              </div>

              <SheetField label="Data da compra" hint="opcional — vazio usa hoje">
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-transparent px-2 text-base text-foreground outline-none [color-scheme:light_dark] focus:border-ring"
                />
              </SheetField>
            </div>
          </BottomSheet>
        )}
      </section>
    );
  }

  return (
    <section>
      <SectionTitle icon={CandlestickChart} className="mb-3">Ações / FIIs</SectionTitle>

      <div className="overflow-x-auto rounded-xl border border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <Th>Ativo</Th>
              <Th right>Qtd</Th>
              <Th right>Preço compra</Th>
              <Th right>Preço atual</Th>
              <Th right>Valor hoje</Th>
              <Th right>Rend.</Th>
              <Th right>%</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const r = results[p.id];
              return (
                <tr key={p.id} className="border-t border">
                  <Td>
                    <span className="font-medium">{p.ticker}</span>
                    {r?.shortName && (
                      <span className="ml-1 text-xs text-muted-foreground">{r.shortName}</span>
                    )}
                  </Td>
                  <Td right>{p.quantidade}</Td>
                  <Td right>{formatBRLCents(p.precoCompra)}</Td>
                  <Td right>{r?.precoAtual != null ? formatBRLCents(r.precoAtual) : "—"}</Td>
                  <Td right>{r?.valorAtual != null ? formatBRLCents(r.valorAtual) : "—"}</Td>
                  <Td right positive={r?.rendimento != null ? r.rendimento >= 0 : undefined}>
                    {r?.rendimento != null ? formatBRLCents(r.rendimento) : "—"}
                  </Td>
                  <Td right positive={r?.rentabilidade != null ? r.rentabilidade >= 0 : undefined}>
                    {pct(r?.rentabilidade ?? null)}
                  </Td>
                  <Td>
                    <Remove onClick={() => onRemove(p.id)} />
                  </Td>
                </tr>
              );
            })}
            <tr className="border-t border bg-secondary">
              <Td>
                <Input placeholder="PETR4" value={ticker} onChange={setTicker} width="w-20" />
              </Td>
              <Td right>
                <Input placeholder="100" value={qtd} onChange={setQtd} width="w-16" />
              </Td>
              <Td right>
                <MoneyInput
                  placeholder="30,50"
                  aria-label="Preço de compra"
                  value={Number(preco) || 0}
                  onChange={(v) => setPreco(v ? String(v) : "")}
                  className="w-20 rounded border border bg-transparent px-2 py-1 text-xs tabular-nums outline-none focus:border-ring"
                />
              </Td>
              <Td colSpan={2}>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="rounded border border bg-card px-1 py-1 text-xs text-foreground [color-scheme:light_dark]"
                />
              </Td>
              <Td colSpan={2}>
                <button
                  onClick={add}
                  className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  + Adicionar
                </button>
              </Td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Preço de compra é o que você pagou (preço médio). A cotação atual vem da brapi.dev.
      </p>
    </section>
  );
}

/* ---------------- UI helpers ---------------- */

function SectionTitle({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className={cn("flex items-center gap-2 text-sm font-semibold", className)}>
      <Icon className="text-muted-foreground size-4" aria-hidden="true" />
      {children}
    </h2>
  );
}

/* Rótulo + valor dentro dos cartões do celular (substitui uma célula da tabela). */
function CardStat({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium tabular-nums",
          positive === undefined ? "" : positive ? "text-positive" : "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* Campo rotulado dos formulários em bottom sheet. */
function SheetField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-muted-foreground mb-1 flex items-baseline gap-2 text-xs">
        {label}
        {hint && <span className="text-[11px] opacity-80">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}
function Td({
  children,
  right,
  positive,
  colSpan,
}: {
  children?: React.ReactNode;
  right?: boolean;
  positive?: boolean;
  colSpan?: number;
}) {
  const color =
    positive === undefined ? "" : positive ? "text-positive" : "text-destructive";
  return (
    <td colSpan={colSpan} className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${color}`}>
      {children}
    </td>
  );
}
function Input({
  value,
  onChange,
  placeholder,
  width = "w-full",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={`${width} rounded border border bg-transparent px-2 py-1 text-xs outline-none focus:border-ring`}
    />
  );
}
function Remove({
  onClick,
  mobile = false,
  label,
}: {
  onClick: () => void;
  mobile?: boolean;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label ? `Remover ${label}` : "Remover"}
      className={cn(
        "text-muted-foreground hover:text-destructive",
        mobile && "-mr-1 grid size-11 shrink-0 place-items-center rounded-lg",
      )}
      title="Remover"
    >
      {mobile ? <Trash2 className="size-5" aria-hidden="true" /> : "✕"}
    </button>
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
    <div className="rounded-xl border border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent ? "text-primary" : positive === false ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
