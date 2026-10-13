// Faz a ponte entre as posições consolidadas do Pluggy (já marcadas a mercado)
// e o modelo de 3 classes da projeção (renda_fixa / acoes / fii).
//
// O Pluggy não distingue ação de FII dentro de EQUITY, então tudo que é renda
// variável cai em "acoes". Fundos/previdência/COE/outros são tratados como
// renda fixa (aproximação conservadora) — o usuário pode refinar as premissas.

import type { ClassId, Macro } from "./marketAssumptions";
import { MACRO_DEFAULT } from "./marketAssumptions";
import type { PreValuedHolding } from "./portfolioProjection";
import type { PluggyPosition } from "@/lib/pluggy/normalize";

/** Categoria textual do Pluggy → classe da projeção. */
export function pluggyCategoriaToClass(categoria: string): ClassId {
  switch (categoria) {
    case "Ações/FIIs":
    case "ETF":
      return "acoes";
    case "Renda fixa":
    case "Fundos":
    case "Previdência":
    case "COE":
    default:
      return "renda_fixa";
  }
}

/** Retorno nominal esperado a.a. para a classe (proxy: renda fixa ≈ 100% CDI). */
export function pluggyExpectedReturn(classId: ClassId, m: Macro = MACRO_DEFAULT): number {
  switch (classId) {
    case "acoes":
      return m.acoes;
    case "fii":
      return m.fii;
    case "renda_fixa":
      return m.cdi;
  }
}

/** Converte as posições do Pluggy em holdings prontos para a projeção. */
export function pluggyToHoldings(
  positions: PluggyPosition[],
  macro: Macro = MACRO_DEFAULT,
): PreValuedHolding[] {
  return positions.map((p) => {
    const classId = pluggyCategoriaToClass(p.categoria);
    return { classId, value: p.valorAtual, expectedReturn: pluggyExpectedReturn(classId, macro) };
  });
}

/** Soma o valor de mercado das posições do Pluggy. */
export function pluggyTotalValue(positions: PluggyPosition[]): number {
  return positions.reduce((s, p) => s + p.valorAtual, 0);
}

/** Soma o valor investido (custo) das posições do Pluggy. */
export function pluggyTotalInvested(positions: PluggyPosition[]): number {
  return positions.reduce((s, p) => s + p.valorInvestido, 0);
}
