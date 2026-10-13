// Mapeia os tipos de evento reais da engine (enums do LLM) para categorias
// amigáveis usadas nos filtros da página Inteligência. NÃO altera nada da lógica
// financeira — é só agrupamento de apresentação/navegação.

export interface EventCategory {
  key: string;
  label: string;
  types: string[]; // event_type reais do banco (market_events.event_type)
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { key: "juros", label: "Juros", types: ["interest_rate_change", "central_bank"] },
  { key: "cambio", label: "Câmbio", types: ["currency_event"] },
  {
    key: "commodities",
    label: "Commodities",
    types: ["commodity_supply", "commodity_demand", "production_disruption", "weather_event"],
  },
  { key: "macro", label: "Macro", types: ["inflation", "economic_growth", "recession"] },
  { key: "empresas", label: "Empresas", types: ["earnings", "regulatory_change", "technology_event"] },
  { key: "exterior", label: "Exterior", types: ["geopolitical_conflict", "political_change"] },
  { key: "outros", label: "Outros", types: ["other"] },
];

const TYPE_TO_CAT = new Map<string, string>();
for (const c of EVENT_CATEGORIES) for (const t of c.types) TYPE_TO_CAT.set(t, c.key);

/** Categoria (key) de um event_type; cai em "outros" se desconhecido. */
export function categoryOf(eventType: string | null | undefined): string {
  return (eventType && TYPE_TO_CAT.get(eventType)) || "outros";
}

/** Rótulo curto da categoria pela key. */
export function categoryLabel(key: string): string {
  return EVENT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** Rótulo de badge para um event_type (usa a categoria). */
export function eventBadgeLabel(eventType: string | null | undefined): string {
  return categoryLabel(categoryOf(eventType));
}
