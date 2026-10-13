// Sugestões proativas de saúde da carteira — lógica PURA e testável. Regras
// simples e determinísticas (reserva de emergência, concentração, diversificação)
// que transformam o diagnóstico em "o que fazer".

import { formatBRL } from "./currency";

export type SuggestionLevel = "alert" | "warn" | "ok";

export interface Suggestion {
  level: SuggestionLevel;
  title: string;
  detail: string;
}

export interface HealthInput {
  patrimonio: number;
  /** Ativos líquidos para a reserva (caixa + renda fixa). */
  liquidez: number;
  /** Gastos fixos médios por mês (ver `mediaSemOutliers`). */
  custoFixoMensal: number;
  /** Fatura média do cartão por mês (ver `mediaSemOutliers`). */
  cartaoMensal: number;
  rendaFixaValor: number;
  acoesFiiValor: number;
  /** Posições individuais (para a regra de concentração). */
  holdings: { nome: string; valor: number }[];
}

const RANK: Record<SuggestionLevel, number> = { alert: 0, warn: 1, ok: 2 };

function pctInt(x: number): string {
  return (x * 100).toFixed(0);
}

/** Quartil por interpolação linear (mesmo método do Excel QUARTIL.INC). */
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface MediaRobusta {
  media: number;
  /** Meses que entraram na média. */
  usados: number;
  /** Meses descartados como outliers. */
  excluidos: number;
}

/**
 * Média mensal descartando outliers pelo critério de Tukey: fica fora quem está
 * abaixo de Q1 − 1,5×IQR ou acima de Q3 + 1,5×IQR. Meses sem valor (≤ 0) não
 * entram. Com menos de 4 meses não há base para quartis: média simples.
 */
export function mediaSemOutliers(valores: number[]): MediaRobusta {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length === 0) return { media: 0, usados: 0, excluidos: 0 };
  let dentro = v;
  if (v.length >= 4) {
    const q1 = quantile(v, 0.25);
    const q3 = quantile(v, 0.75);
    const iqr = q3 - q1;
    dentro = v.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
  }
  const media = dentro.reduce((s, x) => s + x, 0) / dentro.length;
  return { media, usados: dentro.length, excluidos: v.length - dentro.length };
}

/** Avalia a carteira e devolve sugestões, das mais urgentes (alert) às informativas. */
export function analyzePortfolioHealth(i: HealthInput): Suggestion[] {
  const out: Suggestion[] = [];

  // Reserva de emergência: meses de custo de vida (fatura média do cartão + gastos
  // fixos médios) cobertos por ativos líquidos. Alvo: 6 meses desse total.
  const custoMensal = i.cartaoMensal + i.custoFixoMensal;
  if (custoMensal > 0) {
    const meses = i.liquidez / custoMensal;
    const m = meses.toFixed(1).replace(".", ",");
    const alvo = formatBRL(custoMensal * 6);
    const base =
      `Custo de vida: ${formatBRL(custoMensal)}/mês ` +
      `(cartão ${formatBRL(i.cartaoMensal)} + fixos ${formatBRL(i.custoFixoMensal)}, ` +
      "médias dos últimos 12 meses sem outliers). ";
    if (meses < 3) {
      out.push({
        level: "alert",
        title: `Reserva de emergência baixa (${m} meses)`,
        detail:
          base +
          `Meta de 6 meses = ${alvo} em ativos líquidos (caixa + renda fixa). ` +
          "Vale reforçar a reserva antes de assumir mais risco.",
      });
    } else if (meses < 6) {
      out.push({
        level: "warn",
        title: `Reserva de emergência em ${m} meses`,
        detail: base + `A meta de 6 meses é ${alvo} em caixa + renda fixa.`,
      });
    } else {
      out.push({
        level: "ok",
        title: `Reserva de emergência saudável (${m} meses)`,
        detail: base + `Sua liquidez já passa da meta de 6 meses (${alvo}).`,
      });
    }
  }

  // Concentração: peso da maior posição individual no patrimônio.
  if (i.patrimonio > 0 && i.holdings.length > 0) {
    const top = i.holdings.reduce((a, b) => (b.valor > a.valor ? b : a));
    const pctTop = top.valor / i.patrimonio;
    if (pctTop > 0.3) {
      out.push({
        level: "alert",
        title: `Concentração alta: ${top.nome} é ${pctInt(pctTop)}% da carteira`,
        detail:
          "Uma posição acima de ~30% concentra muito risco num único ativo. " +
          "Considere diversificar nos próximos aportes.",
      });
    } else if (pctTop > 0.2) {
      out.push({
        level: "warn",
        title: `${top.nome} pesa ${pctInt(pctTop)}% da carteira`,
        detail: "Acima de 20% num único ativo já é uma concentração relevante — vale ter no radar.",
      });
    }
  }

  // Diversificação por classe: bolsa sem colchão de renda fixa.
  if (i.acoesFiiValor > 0 && i.rendaFixaValor <= 0) {
    out.push({
      level: "warn",
      title: "Carteira sem renda fixa",
      detail:
        "100% em bolsa aumenta a volatilidade e não deixa um colchão para quedas/oportunidades. " +
        "Uma fatia em renda fixa pós-fixada dá liquidez e reduz sustos.",
    });
  }

  return out.sort((a, b) => RANK[a.level] - RANK[b.level]);
}
