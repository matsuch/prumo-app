// Card "Sugestões pra sua carteira": mostra as sugestões de saúde financeira
// (reserva, concentração, diversificação) calculadas por analyzePortfolioHealth.
// Apresentacional. Some quando não há nada a sugerir.

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Suggestion, SuggestionLevel } from "@/lib/domain/portfolioHealth";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const ICON: Record<SuggestionLevel, typeof Info> = {
  alert: AlertTriangle,
  warn: Info,
  ok: CheckCircle2,
};

const TONE: Record<SuggestionLevel, string> = {
  alert: "text-destructive",
  warn: "text-primary",
  ok: "text-positive",
};

export function SuggestionsCard({ suggestions }: { suggestions: Suggestion[] }) {
  if (suggestions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Sugestões pra sua carteira</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((s, i) => {
          const Icon = ICON[s.level];
          return (
            <div key={i} className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[s.level])} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground text-xs">{s.detail}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
