// Motor de projeção de patrimônio.
//
// Modelo (composição mensal, por classe de ativo):
//   valor_{t+1} = valor_t * (1 + r_mensal) + aporte_mensal
// onde r_mensal = (1 + r_anual)^(1/12) - 1.
//
// Como as premissas de retorno são REAIS (ver assets.ts), os valores
// projetados também estão em termos reais (poder de compra de hoje).

import { ASSET_CLASSES, AssetClass, ScenarioKey, getAssetClass } from "./assets";

export interface Holding {
  /** id da classe de ativo (ver ASSET_CLASSES). */
  classId: string;
  /** valor atual investido nesta posição, em R$. */
  currentValue: number;
  /** aporte mensal destinado a esta posição, em R$. */
  monthlyContribution: number;
}

export interface ProjectionPoint {
  /** meses decorridos desde hoje (0 = hoje). */
  month: number;
  /** anos decorridos (month / 12), útil para o eixo X. */
  year: number;
  /** patrimônio total projetado neste ponto. */
  total: number;
  /** patrimônio por classe de ativo: { classId: valor }. */
  byClass: Record<string, number>;
}

function annualToMonthly(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/**
 * Projeta o patrimônio mês a mês para um cenário, retornando um ponto por ano
 * (incluindo o ano 0 = hoje).
 */
export function projectPortfolio(
  holdings: Holding[],
  scenario: ScenarioKey,
  years: number,
  classes: AssetClass[] = ASSET_CLASSES,
): ProjectionPoint[] {
  const totalMonths = Math.round(years * 12);

  // Estado corrente por classe de ativo.
  const value: Record<string, number> = {};
  const contribution: Record<string, number> = {};
  const monthlyRate: Record<string, number> = {};

  for (const cls of classes) {
    value[cls.id] = 0;
    contribution[cls.id] = 0;
    monthlyRate[cls.id] = annualToMonthly(cls.returns[scenario]);
  }
  for (const h of holdings) {
    if (value[h.classId] === undefined) continue; // ignora classe desconhecida
    value[h.classId] += h.currentValue;
    contribution[h.classId] += h.monthlyContribution;
  }

  const points: ProjectionPoint[] = [];
  const snapshot = (month: number): ProjectionPoint => {
    const byClass: Record<string, number> = {};
    let total = 0;
    for (const cls of classes) {
      byClass[cls.id] = value[cls.id];
      total += value[cls.id];
    }
    return { month, year: month / 12, total, byClass };
  };

  points.push(snapshot(0));
  for (let m = 1; m <= totalMonths; m++) {
    for (const cls of classes) {
      value[cls.id] = value[cls.id] * (1 + monthlyRate[cls.id]) + contribution[cls.id];
    }
    if (m % 12 === 0) points.push(snapshot(m));
  }
  return points;
}

export interface ScenarioBand {
  pessimista: ProjectionPoint[];
  base: ProjectionPoint[];
  otimista: ProjectionPoint[];
}

/** Projeta os três cenários de uma vez (para o gráfico com faixa). */
export function projectAllScenarios(holdings: Holding[], years: number): ScenarioBand {
  return {
    pessimista: projectPortfolio(holdings, "pessimista", years),
    base: projectPortfolio(holdings, "base", years),
    otimista: projectPortfolio(holdings, "otimista", years),
  };
}

/** Soma dos aportes feitos ao longo do período (base para medir o "juro"). */
export function totalContributed(holdings: Holding[], years: number): number {
  const initial = holdings.reduce((s, h) => s + h.currentValue, 0);
  const monthly = holdings.reduce((s, h) => s + h.monthlyContribution, 0);
  return initial + monthly * Math.round(years * 12);
}

/**
 * Estima a renda passiva mensal a partir de um patrimônio final, usando uma
 * taxa de retirada segura anual (padrão 4% a.a. — regra clássica).
 */
export function passiveIncomeMonthly(finalWealth: number, withdrawalRate = 0.04): number {
  return (finalWealth * withdrawalRate) / 12;
}

export { getAssetClass };
