// Análise de uma meta financeira cruzando com a projeção da carteira.
//
// A projeção é LINEAR no aporte mensal: patrimônio_final(aporte) = base0 + aporte*k,
// onde base0 é a projeção sem aportes e k é o quanto R$1/mês vira no fim do prazo.
// Isso permite resolver diretamente o aporte necessário para bater a meta.

export interface GoalAnalysis {
  anos: number;
  projetado: number; // patrimônio projetado no prazo, com o aporte atual da meta
  atinge: boolean;
  aporteNecessario: number; // R$/mês para atingir a meta no prazo (0 se já atinge sem aportes)
  progressoHoje: number; // patrimônio hoje / valor alvo (0..1+)
}

export function analyzeGoal(
  valorAlvo: number,
  anos: number,
  patrimonioHoje: number,
  aporteMeta: number,
  /** projeta o patrimônio ao fim do prazo para um dado aporte mensal. */
  projectBase: (aporteMensal: number) => number,
): GoalAnalysis {
  const base0 = projectBase(0);
  const projetado = projectBase(aporteMeta);

  const probe = 1000;
  const k = (projectBase(probe) - base0) / probe; // patrimônio final por R$1/mês

  let aporteNecessario = 0;
  if (base0 < valorAlvo) {
    aporteNecessario = k > 0 ? (valorAlvo - base0) / k : Infinity;
  }

  return {
    anos,
    projetado,
    atinge: projetado >= valorAlvo,
    aporteNecessario: Math.max(0, aporteNecessario),
    progressoHoje: valorAlvo > 0 ? patrimonioHoje / valorAlvo : 0,
  };
}

/** Anos entre hoje e uma data ISO (mínimo 0). */
export function anosAte(dataISO: string): number {
  const alvo = new Date(`${dataISO}T00:00:00Z`).getTime();
  return Math.max((alvo - Date.now()) / (365.25 * 86_400_000), 0);
}
