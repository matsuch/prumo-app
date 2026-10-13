// Premissas de retorno FUTURO (nominal anual) usadas na projeção da carteira.
// São editáveis pelo usuário no dashboard — os defaults são pontos de partida
// razoáveis para o Brasil, não previsões.

import type { ScenarioKey } from "./assets";
import type { FixedIncomePosition } from "./fixedIncome";

export interface Macro {
  cdi: number; // CDI nominal esperado a.a.
  selic: number; // Selic nominal esperada a.a.
  ipca: number; // inflação esperada a.a.
  acoes: number; // retorno nominal esperado de ações a.a.
  fii: number; // retorno nominal esperado de FIIs a.a.
}

export const MACRO_DEFAULT: Macro = {
  cdi: 0.105,
  selic: 0.105,
  ipca: 0.045,
  acoes: 0.11,
  fii: 0.09,
};

export type ClassId = "renda_fixa" | "acoes" | "fii";

// Amplitude do cenário (± em pontos percentuais) por classe: a incerteza da
// renda variável é maior que a da renda fixa.
const SCENARIO_DELTA: Record<ClassId, number> = {
  renda_fixa: 0.015,
  acoes: 0.05,
  fii: 0.03,
};

export const CLASSES_META: Record<ClassId, { label: string; color: string }> = {
  renda_fixa: { label: "Renda fixa", color: "#2d4263" },
  acoes: { label: "Ações", color: "#c84b31" },
  fii: { label: "FIIs", color: "#a6874f" },
};

/** Heurística: ticker terminando em 11 é FII (HGLG11, MXRF11). */
export function isFII(ticker: string): boolean {
  return /11$/.test(ticker.trim().toUpperCase());
}

/** Retorno nominal esperado a.a. de um título de renda fixa, dado o indexador. */
export function rfExpectedNominal(pos: FixedIncomePosition, m: Macro): number {
  switch (pos.indexador) {
    case "PREFIXADO":
      return pos.taxa / 100;
    case "CDI":
      return (pos.taxa / 100) * m.cdi;
    case "SELIC":
      return (pos.taxa / 100) * m.selic;
    case "IPCA":
      return (1 + m.ipca) * (1 + pos.taxa / 100) - 1;
  }
}

/** Deriva os três cenários a partir do retorno base de uma classe. */
export function scenarioReturns(base: number, classId: ClassId): Record<ScenarioKey, number> {
  const d = SCENARIO_DELTA[classId];
  return { pessimista: Math.max(base - d, 0), base, otimista: base + d };
}
