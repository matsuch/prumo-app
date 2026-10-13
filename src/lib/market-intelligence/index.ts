// Versão pública: a fachada da engine de inteligência de mercado fica na versão
// privada. Aqui só existe o que as telas públicas consultam, sem dados.
export const marketIntelligence = {
  /** Sensibilidade histórica do ativo a fatores externos (privado: vazio aqui). */
  async assetFactorReactions(ticker: string): Promise<never[]> {
    void ticker;
    return [];
  },
};
