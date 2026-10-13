// Fonte ÚNICA dos cálculos de performance da carteira (rendimento e
// rentabilidade). Nenhum componente deve recalcular isso por conta própria.
//
// Regra central: FLUXO DE DINHEIRO NÃO É PERFORMANCE.
//   - Aporte aumenta o patrimônio, mas não é rendimento.
//   - Resgate reduz o patrimônio, mas não é prejuízo.
//   - Só a valorização efetiva (juros, valorização, dividendos) compõe o ganho.
//
// Convenção de sinais dos fluxos de caixa (ótica do investidor, padrão XIRR):
//   - Aporte      → valor NEGATIVO (dinheiro sai do bolso para a carteira)
//   - Resgate     → valor POSITIVO (dinheiro volta para o bolso)
//   - Valor atual → valor POSITIVO na data de avaliação (liquidação teórica)

export interface CashFlow {
  date: string; // ISO yyyy-mm-dd
  amount: number; // aporte < 0 · resgate/valor atual > 0
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;

function toTime(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

/** Diferença em anos (fração) entre duas datas ISO. */
export function yearsBetween(aISO: string, bISO: string): number {
  return (toTime(bISO) - toTime(aISO)) / (MS_PER_DAY * DAYS_PER_YEAR);
}

function sortFlows(flows: CashFlow[]): CashFlow[] {
  return [...flows].sort((a, b) => toTime(a.date) - toTime(b.date));
}

// Valor presente líquido dos fluxos a uma taxa anual `rate`, descontando cada
// fluxo pelo tempo (em anos) desde a primeira data.
function npv(rate: number, flows: CashFlow[], t0: string): number {
  return flows.reduce((sum, f) => {
    const t = yearsBetween(t0, f.date);
    return sum + f.amount / Math.pow(1 + rate, t);
  }, 0);
}

function dNpv(rate: number, flows: CashFlow[], t0: string): number {
  return flows.reduce((sum, f) => {
    const t = yearsBetween(t0, f.date);
    if (t === 0) return sum;
    return sum - (t * f.amount) / Math.pow(1 + rate, t + 1);
  }, 0);
}

/**
 * XIRR — taxa interna de retorno ANUALIZADA de fluxos datados (money-weighted).
 * Retorna a taxa anual (fração; 0.1 = 10% a.a.) ou `null` quando não é possível
 * calcular (menos de 2 fluxos, todos na mesma data, ou sem sinais mistos).
 * Newton-Raphson com fallback por bisseção para robustez.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;
  const sorted = sortFlows(flows);
  const t0 = sorted[0].date;
  const tN = sorted[sorted.length - 1].date;
  if (yearsBetween(t0, tN) <= 0) return null; // sem intervalo → não anualiza
  const hasNeg = sorted.some((f) => f.amount < 0);
  const hasPos = sorted.some((f) => f.amount > 0);
  if (!hasNeg || !hasPos) return null;

  // Newton-Raphson.
  let rate = 0.1;
  for (let i = 0; i < 100; i += 1) {
    const f = npv(rate, sorted, t0);
    if (Math.abs(f) < 1e-7) return rate;
    const df = dNpv(rate, sorted, t0);
    if (df === 0 || !Number.isFinite(df)) break;
    let next = rate - f / df;
    if (!Number.isFinite(next)) break;
    if (next <= -0.999999) next = (rate - 0.999999) / 2; // mantém 1+rate > 0
    if (Math.abs(next - rate) < 1e-10) {
      rate = next;
      break;
    }
    rate = next;
  }
  if (Math.abs(npv(rate, sorted, t0)) < 1e-4) return rate;

  // Fallback: bisseção em [-0,9999; 100] se houver troca de sinal.
  let lo = -0.9999;
  let hi = 100;
  let flo = npv(lo, sorted, t0);
  const fhi = npv(hi, sorted, t0);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 300; i += 1) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid, sorted, t0);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (flo * fmid < 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

// Retorno simples do conjunto de fluxos, ignorando datas: entradas / saídas − 1.
// Usado como fallback quando todos os fluxos ocorrem no mesmo dia (não dá para
// anualizar) — nesse caso o resultado coincide com rendimento ÷ capital.
function simpleReturn(flows: CashFlow[]): number | null {
  const outflow = -flows.filter((f) => f.amount < 0).reduce((s, f) => s + f.amount, 0); // aportes
  const inflow = flows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0); // resgates + valor atual
  return outflow > 0 ? inflow / outflow - 1 : null;
}

/**
 * Rentabilidade ACUMULADA (não anualizada): quanto a carteira valorizou desde o
 * primeiro fluxo até a data de avaliação, considerando o momento de cada aporte
 * e resgate. Consistente com a XIRR: acumulada = (1 + XIRR)^T − 1, com T em anos.
 * Para um aporte único, coincide com valor atual ÷ aporte − 1 (independe do prazo).
 */
export function accumulatedReturn(flows: CashFlow[], valuationDate?: string): number | null {
  if (flows.length < 2) return null;
  const sorted = sortFlows(flows);
  const t0 = sorted[0].date;
  const tEnd = valuationDate ?? sorted[sorted.length - 1].date;
  const span = yearsBetween(t0, tEnd);
  if (span <= 0) return simpleReturn(sorted); // mesmo dia → retorno simples
  const r = xirr(sorted);
  if (r == null) return simpleReturn(sorted);
  return Math.pow(1 + r, span) - 1;
}

/**
 * Retorno do PERÍODO ajustado por fluxos (Modified Dietz). Usado para a
 * performance mensal: o aporte/resgate feito no meio do período entra com peso
 * proporcional ao tempo em que ficou investido, para não inflar nem deprimir o
 * retorno. Aqui os fluxos são da ótica do PATRIMÔNIO: aporte > 0, resgate < 0.
 */
export function modifiedDietzReturn(
  startValue: number,
  endValue: number,
  periodStart: string,
  periodEnd: string,
  flows: { date: string; amount: number }[],
): number | null {
  const totalDays = (toTime(periodEnd) - toTime(periodStart)) / MS_PER_DAY;
  if (totalDays <= 0) return null;
  const netFlow = flows.reduce((s, f) => s + f.amount, 0);
  const gain = endValue - startValue - netFlow; // ganho REAL, sem os fluxos
  const weighted = flows.reduce((s, f) => {
    const daysRemaining = (toTime(periodEnd) - toTime(f.date)) / MS_PER_DAY;
    return s + f.amount * (daysRemaining / totalDays);
  }, 0);
  const base = startValue + weighted;
  if (base <= 0) return null;
  return gain / base;
}

/** Ganho financeiro em reais: valor atual − capital líquido investido. */
export function rendimento(valorAtual: number, capitalLiquido: number): number {
  return valorAtual - capitalLiquido;
}

// ---------------------------------------------------------------------------
// Derivação de fluxos a partir do histórico de "investido" (custo) dos snapshots
// ---------------------------------------------------------------------------

export interface InvestidoPoint {
  date: string; // ISO yyyy-mm-dd
  investido: number; // capital líquido acumulado (aportes − resgates) até a data
}

/**
 * Constrói os fluxos de caixa a partir da série de capital investido ao longo do
 * tempo: cada VARIAÇÃO do investido entre datas é um aporte (subiu) ou resgate
 * (desceu). O valor atual entra como fluxo positivo na data de avaliação.
 */
export function buildCashFlows(
  series: InvestidoPoint[],
  valuation: { date: string; patrimonio: number },
): CashFlow[] {
  // Agrega por data (mantém o último investido do dia) e ordena.
  const byDate = new Map<string, number>();
  for (const p of [...series].sort((a, b) => toTime(a.date) - toTime(b.date))) {
    byDate.set(p.date, p.investido);
  }
  const flows: CashFlow[] = [];
  let prev = 0;
  for (const [date, investido] of byDate) {
    const delta = investido - prev; // +aporte / −resgate
    if (Math.abs(delta) > 1e-6) flows.push({ date, amount: -delta });
    prev = investido;
  }
  flows.push({ date: valuation.date, amount: valuation.patrimonio });
  return flows;
}

export interface PortfolioPerformance {
  capitalLiquido: number; // aportes − resgates
  valorAtual: number;
  rendimento: number; // valor atual − capital líquido (R$)
  rentabilidadeAcumulada: number | null; // fração (0.1 = 10%), desde o início
  rentabilidadeAnualizada: number | null; // fração a.a. (XIRR)
}

/**
 * Performance consolidada da carteira na data `today`. `series` é o histórico de
 * capital investido (dos snapshots); `patrimonio`/`investido` são os valores
 * atuais. Sem histórico suficiente, a acumulada cai para o retorno simples
 * (valor atual ÷ capital − 1) e a anualizada fica indisponível.
 */
export function computePortfolioPerformance(input: {
  series: InvestidoPoint[];
  today: string;
  patrimonio: number;
  investido: number;
}): PortfolioPerformance {
  const { series, today, patrimonio, investido } = input;
  const fullSeries: InvestidoPoint[] = [...series, { date: today, investido }];
  const flows = buildCashFlows(fullSeries, { date: today, patrimonio });
  return {
    capitalLiquido: investido,
    valorAtual: patrimonio,
    rendimento: rendimento(patrimonio, investido),
    rentabilidadeAcumulada: accumulatedReturn(flows, today),
    rentabilidadeAnualizada: xirr(flows),
  };
}

/**
 * Rentabilidade acumulada em uma data passada `at` (para a comparação mês a mês).
 * Usa o histórico truncado até essa data e o patrimônio/investido de então.
 */
export function accumulatedReturnAt(
  series: InvestidoPoint[],
  at: { date: string; patrimonio: number; investido: number },
): number | null {
  const truncated = series.filter((p) => p.date <= at.date);
  const full: InvestidoPoint[] = [...truncated, { date: at.date, investido: at.investido }];
  const flows = buildCashFlows(full, { date: at.date, patrimonio: at.patrimonio });
  return accumulatedReturn(flows, at.date);
}
