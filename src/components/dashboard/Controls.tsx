"use client";

// Controles do Dashboard: o seletor de período do gráfico de evolução (PeriodToggle)
// e o painel expansível de premissas de mercado da projeção (MacroControls).

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Macro } from "@/lib/domain/marketAssumptions";
import type { Periodo } from "@/lib/domain/dashboardMetrics";
import { Button } from "../ui/button";

export function PeriodToggle({
  value,
  onChange,
  mobile = false,
}: {
  value: Periodo;
  onChange: (p: Periodo) => void;
  /** Modo celular: ocupa a largura toda, com alvos de toque maiores. */
  mobile?: boolean;
}) {
  const opts: { v: Periodo; label: string }[] = [
    { v: "3m", label: "3m" },
    { v: "6m", label: "6m" },
    { v: "1a", label: "1a" },
    { v: "tudo", label: "Tudo" },
  ];
  return (
    <div className={cn("bg-secondary inline-flex rounded-lg p-0.5", mobile && "w-full")}>
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "rounded-md text-xs font-medium transition-colors",
            mobile ? "min-h-10 flex-1 px-2 text-sm" : "px-2.5 py-1",
            value === o.v
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MacroControls({
  macro,
  onChange,
  mobile = false,
}: {
  macro: Macro;
  onChange: (m: Macro) => void;
  /** Modo celular: campos com 16px de fonte (evita o zoom automático do iOS). */
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const fields: { key: keyof Macro; label: string }[] = [
    { key: "cdi", label: "CDI a.a." },
    { key: "ipca", label: "IPCA a.a." },
    { key: "acoes", label: "Ações a.a." },
    { key: "fii", label: "FIIs a.a." },
  ];
  return (
    <div className="mt-4 border-t pt-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "text-muted-foreground h-auto px-0 font-medium hover:bg-transparent",
          mobile ? "min-h-11 py-2 text-sm" : "py-0",
        )}
        aria-expanded={open}
      >
        {open ? "▾" : "▸"} Premissas de mercado
      </Button>
      {open && (
        <div className={cn("mt-3 grid grid-cols-2 gap-3", !mobile && "sm:grid-cols-4")}>
          {fields.map((f) => (
            <label key={f.key} className="text-xs">
              <span className="text-muted-foreground">{f.label}</span>
              <div className="border-input mt-0.5 flex items-center rounded-md border bg-transparent px-2">
                <input
                  type="number"
                  step={0.5}
                  value={(macro[f.key] * 100).toFixed(1)}
                  onChange={(e) => onChange({ ...macro, [f.key]: Number(e.target.value) / 100 })}
                  className={cn(
                    "w-full bg-transparent tabular-nums outline-none",
                    mobile ? "py-2 text-base" : "py-1.5 text-sm",
                  )}
                  aria-label={f.label}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
