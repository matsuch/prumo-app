// Versão pública: só as janelas usadas pelo provedor de cotações. Os pesos e
// limites da engine ficam na versão privada.
export const HISTORY = {
  shortWindow: 5,
  mediumWindow: 20,
  volatilityWindow: 20,
  /** Histórico buscado por ativo (dias) — cobre 20d de retorno + folga. */
  fetchDays: 40,
} as const;
