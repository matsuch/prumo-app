// Lógica PURA do Dashboard (datas, tendências, rótulos). Vivia dentro de
// Dashboard.tsx; extraída para cá para enxugar o componente e ficar testável sem
// montar a UI. Sem JSX e sem hooks: só recebe dados e devolve valores/strings.

import type { FixedIncomePosition } from "@/lib/domain/fixedIncome";
import { formatBRLCents } from "@/lib/domain/currency";
import { todayISO } from "@/lib/domain/cards";
import type { Snapshot } from "@/lib/supabase/snapshots";

/** Produto investido (manual ou Pluggy) exibido na composição do patrimônio. */
export interface Produto {
  id: string;
  nome: string;
  detalhe?: string;
  grupo: string;
  valor: number;
}

/** Variação exibida como badge nos KPIs (seta + rótulo). */
export interface Trend {
  up: boolean;
  badge: string;
}

export type Periodo = "3m" | "6m" | "1a" | "tudo";

/** Rótulo da taxa de um título de renda fixa (ex.: "IPCA+6%", "12% CDI"). */
export function fixedTaxa(p: FixedIncomePosition): string {
  if (p.indexador === "IPCA") return `IPCA+${p.taxa}%`;
  if (p.indexador === "PREFIXADO") return `${p.taxa}% a.a.`;
  return `${p.taxa}% ${p.indexador}`;
}

export function pct(v: number): string {
  return `${(v * 100).toFixed(1).replace(".", ",")}%`;
}

/** Variação percentual do valor (ex.: patrimônio) — nula se a base não for > 0. */
export function pctTrend(now: number, prev: number): Trend | null {
  if (!(prev > 0)) return null;
  const d = (now - prev) / prev;
  return { up: d >= 0, badge: `${d >= 0 ? "+" : "−"}${pct(Math.abs(d))}` };
}

/** Variação em reais (ex.: rendimento), onde % não faz sentido (base pode ser ~0). */
export function valueTrend(now: number, prev: number): Trend {
  const d = now - prev;
  return { up: d >= 0, badge: `${d >= 0 ? "+" : "−"}${formatBRLCents(Math.abs(d))}` };
}

/** Variação em pontos percentuais (ex.: rentabilidade, que já é um %). */
export function ppTrend(now: number, prev: number): Trend {
  const d = (now - prev) * 100;
  return {
    up: d >= 0,
    badge: `${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(1).replace(".", ",")} pp`,
  };
}

export function addMonthsISO(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Baseline para comparação: o snapshot de ~1 mês atrás (o mais recente com data
// <= hoje−1mês). Se ainda não houver histórico de um mês, usa o snapshot mais
// antigo disponível e ajusta o rótulo.
export function baselineMesAnterior(
  snaps: Snapshot[],
  hoje: string,
): { snap: Snapshot; label: string } | null {
  const alvo = addMonthsISO(hoje, -1);
  const anteriores = snaps.filter((s) => s.data < hoje).sort((a, b) => (a.data < b.data ? 1 : -1));
  if (anteriores.length === 0) return null;
  const doMes = anteriores.find((s) => s.data <= alvo);
  if (doMes) return { snap: doMes, label: "vs mês anterior" };
  const antigo = anteriores[anteriores.length - 1];
  return {
    snap: antigo,
    label: `desde ${new Date(`${antigo.data}T00:00:00Z`).toLocaleDateString("pt-BR")}`,
  };
}

/** Filtra uma série temporal (qualquer ponto com `date`) pela janela escolhida. */
export function filtrarPeriodo<T extends { date: Date }>(data: T[], periodo: Periodo): T[] {
  if (periodo === "tudo") return data;
  const meses = periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12;
  const corte = new Date(`${addMonthsISO(todayISO(), -meses)}T00:00:00Z`);
  return data.filter((d) => d.date >= corte);
}
