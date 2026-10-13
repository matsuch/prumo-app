"use client";

import { useMemo, useState } from "react";
import { ASSET_CLASSES } from "@/lib/domain/assets";
import {
  Holding,
  projectAllScenarios,
  totalContributed,
  passiveIncomeMonthly,
} from "@/lib/domain/projection";
import { formatBRL, formatBRLCents } from "@/lib/domain/currency";
import ProjectionChart from "./ProjectionChart";

type HoldingInput = Record<string, { currentValue: number; monthlyContribution: number }>;

const DEFAULTS: HoldingInput = {
  renda_fixa: { currentValue: 30000, monthlyContribution: 800 },
  acoes: { currentValue: 15000, monthlyContribution: 500 },
  fii: { currentValue: 10000, monthlyContribution: 300 },
};

export default function Simulator() {
  const [inputs, setInputs] = useState<HoldingInput>(DEFAULTS);
  const [years, setYears] = useState(10);

  const holdings: Holding[] = useMemo(
    () =>
      ASSET_CLASSES.map((c) => ({
        classId: c.id,
        currentValue: inputs[c.id]?.currentValue ?? 0,
        monthlyContribution: inputs[c.id]?.monthlyContribution ?? 0,
      })),
    [inputs],
  );

  const band = useMemo(() => projectAllScenarios(holdings, years), [holdings, years]);

  const finalBase = band.base[band.base.length - 1]?.total ?? 0;
  const finalPess = band.pessimista[band.pessimista.length - 1]?.total ?? 0;
  const finalOtim = band.otimista[band.otimista.length - 1]?.total ?? 0;
  const invested = totalContributed(holdings, years);
  const gains = finalBase - invested;
  const income = passiveIncomeMonthly(finalBase);

  const set = (id: string, field: "currentValue" | "monthlyContribution", v: number) =>
    setInputs((prev) => ({ ...prev, [id]: { ...prev[id], [field]: v } }));

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Painel de entradas */}
      <div className="space-y-5 rounded-xl border border-border bg-surface p-5">
        <div>
          <label className="flex items-center justify-between text-sm font-medium">
            <span>Horizonte</span>
            <span className="tabular-nums text-accent">{years} anos</span>
          </label>
          <input
            type="range"
            min={1}
            max={40}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="mt-2 w-full accent-[var(--accent)]"
          />
        </div>

        <div className="space-y-4">
          {ASSET_CLASSES.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.label}
                <span className="ml-auto text-xs font-normal text-muted">
                  {(c.returns.base * 100).toFixed(0)}% a.a. (base)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field
                  label="Hoje"
                  value={inputs[c.id]?.currentValue ?? 0}
                  onChange={(v) => set(c.id, "currentValue", v)}
                />
                <Field
                  label="Aporte/mês"
                  value={inputs[c.id]?.monthlyContribution ?? 0}
                  onChange={(v) => set(c.id, "monthlyContribution", v)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resultados */}
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Patrimônio (base)" value={formatBRL(finalBase)} accent />
          <Stat label="Total investido" value={formatBRL(invested)} />
          <Stat label="Rendimento" value={formatBRL(gains)} />
          <Stat label="Renda passiva/mês" value={formatBRLCents(income)} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              Projeção em {years} anos <span className="text-muted">(valores reais)</span>
            </h2>
            <p className="text-xs text-muted">
              {formatBRL(finalPess)} — {formatBRL(finalOtim)}
            </p>
          </div>
          <ProjectionChart band={band} />
          <p className="mt-3 text-xs text-muted">
            Faixa entre cenário pessimista e otimista; linha central = cenário base. Premissas de
            retorno reais por classe de ativo.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      <div className="mt-0.5 flex items-center rounded-lg border border-border px-2 focus-within:border-blue-500">
        <span className="text-xs text-muted">R$</span>
        <input
          type="number"
          min={0}
          step={100}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full bg-transparent py-1.5 pl-1 text-sm tabular-nums outline-none"
        />
      </div>
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
