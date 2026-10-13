// Constrói os insumos de projeção A PARTIR da carteira real: agrega o valor
// atual por classe e calcula o retorno esperado (média ponderada pelo valor
// de cada posição), derivando os três cenários.

import type { AssetClass } from "./assets";
import type { Holding, ProjectionPoint, ScenarioBand } from "./projection";
import { projectPortfolio } from "./projection";
import type { FixedIncomePosition } from "./fixedIncome";
import type { StockPosition } from "./stocks";
import {
  CLASSES_META,
  ClassId,
  Macro,
  MACRO_DEFAULT,
  isFII,
  rfExpectedNominal,
  scenarioReturns,
} from "./marketAssumptions";

export interface ProjectionInputs {
  classes: AssetClass[];
  holdings: Holding[];
  /** valor atual agregado por classe. */
  byClassValue: Record<string, number>;
  totalValue: number;
}

/**
 * Posição já marcada a mercado (ex.: vinda do Pluggy), pronta para entrar na
 * projeção sem recálculo: sabemos o valor atual, a classe e o retorno esperado.
 */
export interface PreValuedHolding {
  classId: ClassId;
  value: number;
  /** retorno nominal esperado a.a. desta posição. */
  expectedReturn: number;
}

export function buildProjectionInputs(
  fixed: FixedIncomePosition[],
  stocks: StockPosition[],
  fixedValues: Record<string, number>,
  stockValues: Record<string, number>,
  aporteMensal: number,
  macro: Macro = MACRO_DEFAULT,
  extra: PreValuedHolding[] = [],
): ProjectionInputs {
  const acc: Record<ClassId, { value: number; retWeighted: number }> = {
    renda_fixa: { value: 0, retWeighted: 0 },
    acoes: { value: 0, retWeighted: 0 },
    fii: { value: 0, retWeighted: 0 },
  };

  for (const p of fixed) {
    const v = fixedValues[p.id] ?? p.valorAplicado;
    acc.renda_fixa.value += v;
    acc.renda_fixa.retWeighted += v * rfExpectedNominal(p, macro);
  }
  for (const s of stocks) {
    const v = stockValues[s.id] ?? s.quantidade * s.precoCompra;
    const cls: ClassId = isFII(s.ticker) ? "fii" : "acoes";
    acc[cls].value += v;
    acc[cls].retWeighted += v * (cls === "fii" ? macro.fii : macro.acoes);
  }
  // Posições já marcadas a mercado (Pluggy) entram direto pela classe informada.
  for (const h of extra) {
    if (h.value <= 0) continue;
    acc[h.classId].value += h.value;
    acc[h.classId].retWeighted += h.value * h.expectedReturn;
  }

  const totalValue = acc.renda_fixa.value + acc.acoes.value + acc.fii.value;
  const classes: AssetClass[] = [];
  const holdings: Holding[] = [];
  const byClassValue: Record<string, number> = {};

  (Object.keys(acc) as ClassId[]).forEach((id) => {
    const a = acc[id];
    if (a.value <= 0) return;
    const baseRet = a.retWeighted / a.value;
    classes.push({
      id,
      label: CLASSES_META[id].label,
      color: CLASSES_META[id].color,
      returns: scenarioReturns(baseRet, id),
    });
    const weight = totalValue > 0 ? a.value / totalValue : 0;
    holdings.push({ classId: id, currentValue: a.value, monthlyContribution: aporteMensal * weight });
    byClassValue[id] = a.value;
  });

  return { classes, holdings, byClassValue, totalValue };
}

/** Projeta os três cenários usando as classes derivadas da carteira. */
export function projectFromPortfolio(inputs: ProjectionInputs, years: number): ScenarioBand {
  const run = (scenario: "pessimista" | "base" | "otimista"): ProjectionPoint[] =>
    projectPortfolio(inputs.holdings, scenario, years, inputs.classes);
  return {
    pessimista: run("pessimista"),
    base: run("base"),
    otimista: run("otimista"),
  };
}
