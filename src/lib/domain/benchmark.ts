// Comparação da carteira com benchmarks (CDI, IBOV) — lógica PURA e testável.
//
// Método: aplica os MESMOS fluxos de caixa da carteira (aportes/resgates, nas
// mesmas datas) ao índice de referência e vê quanto o capital valeria hoje. Assim
// a comparação é justa com a rentabilidade money-weighted (não é buy-and-hold de
// um valor único): responde "se esse dinheiro, nessas datas, tivesse ido pro CDI".

import type { CashFlow } from "./portfolioPerformance";

/** Ponto de um índice acumulado: `factor` é o nível/fator acumulado na data.
 * Para o IBOV, `factor` é o preço de fechamento; para o CDI, o fator composto. */
export interface IndexPoint {
  date: string; // ISO yyyy-mm-dd
  factor: number;
}

/**
 * Constrói `growthToEnd(date)` = crescimento do índice da `date` até o fim da
 * série (fatorFinal / fatorNaData). Usa o último ponto com data <= a informada
 * (pregão anterior). Antes do primeiro ponto, usa o primeiro; se o fator for
 * inválido, devolve 1 (sem crescimento). Série pequena → varredura linear basta.
 */
export function makeGrowthToEnd(points: IndexPoint[]): (dateISO: string) => number {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) return () => 1;
  const end = sorted[sorted.length - 1].factor;
  return (dateISO: string) => {
    let f = sorted[0].factor;
    for (const p of sorted) {
      if (p.date <= dateISO) f = p.factor;
      else break;
    }
    return f > 0 && Number.isFinite(end) ? end / f : 1;
  };
}

export interface BenchmarkResult {
  /** Capital líquido aportado (aportes − resgates). */
  capital: number;
  /** Valor que esse capital teria hoje no índice. */
  valorFinal: number;
  /** Rentabilidade acumulada do índice sob os mesmos fluxos (fração; 0.1 = 10%). */
  acumulada: number;
}

/**
 * Aplica os fluxos de CONTRIBUIÇÃO (aportes/resgates — SEM o fluxo final de
 * avaliação da carteira) ao índice e devolve a rentabilidade acumulada. Cada
 * aporte cresce pelo índice desde a sua data; resgate remove capital que teria
 * crescido. Retorna `null` sem capital positivo (nada a comparar).
 */
export function benchmarkAccumulated(
  contribs: CashFlow[],
  growthToEnd: (dateISO: string) => number,
): BenchmarkResult | null {
  let capital = 0;
  let valorFinal = 0;
  for (const f of contribs) {
    const c = -f.amount; // aporte: amount<0 → c>0; resgate: amount>0 → c<0
    capital += c;
    valorFinal += c * growthToEnd(f.date);
  }
  if (capital <= 0) return null;
  return { capital, valorFinal, acumulada: valorFinal / capital - 1 };
}

/**
 * "% do CDI": quanto a rentabilidade da carteira representa frente ao benchmark,
 * ambos no MESMO período. Ex.: carteira 8%, CDI 5% → 1.6 (160% do CDI). Retorna
 * `null` quando o benchmark é ~0 (razão sem sentido).
 */
export function pctOfBenchmark(carteira: number, benchmark: number): number | null {
  if (Math.abs(benchmark) < 1e-6) return null;
  return carteira / benchmark;
}
