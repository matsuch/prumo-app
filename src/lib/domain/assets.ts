// Classes de ativo do MVP e suas premissas de retorno REAL anual (já
// descontada a inflação), por cenário. Valores de rascunho — ajustar com
// fonte oficial (ver ESCOPO.md §Premissas).

export type ScenarioKey = "pessimista" | "base" | "otimista";

export const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: "pessimista", label: "Pessimista" },
  { key: "base", label: "Base" },
  { key: "otimista", label: "Otimista" },
];

export interface AssetClass {
  id: string;
  label: string;
  color: string;
  /** Retorno real anual (ex.: 0.04 = 4% a.a.) por cenário. */
  returns: Record<ScenarioKey, number>;
}

export const ASSET_CLASSES: AssetClass[] = [
  {
    id: "renda_fixa",
    label: "Renda fixa",
    color: "#2d4263", // navy
    returns: { pessimista: 0.02, base: 0.04, otimista: 0.05 },
  },
  {
    id: "acoes",
    label: "Ações (B3)",
    color: "#c84b31", // rust
    returns: { pessimista: 0.02, base: 0.07, otimista: 0.12 },
  },
  {
    id: "fii",
    label: "FIIs",
    color: "#a6874f", // dourado (tom da família cream)
    returns: { pessimista: 0.03, base: 0.06, otimista: 0.09 },
  },
];

export function getAssetClass(id: string): AssetClass | undefined {
  return ASSET_CLASSES.find((c) => c.id === id);
}
