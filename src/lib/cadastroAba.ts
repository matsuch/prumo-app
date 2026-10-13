// Abas da tela de Cadastro. Fica fora do componente (que é "use client") porque a
// página do servidor precisa interpretar o ?aba= — função de módulo client não
// pode ser chamada no servidor.

export const CADASTRO_ABA_IDS = ["mes", "investimentos", "metas"] as const;

export type CadastroAba = (typeof CADASTRO_ABA_IDS)[number];

export function parseAba(v: string | undefined | null): CadastroAba {
  return CADASTRO_ABA_IDS.includes(v as CadastroAba) ? (v as CadastroAba) : "mes";
}
