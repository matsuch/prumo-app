"use client";

// Card "Composição do patrimônio": barra investimentos vs. caixa, dívida de cartão
// e a lista (expansível) de produtos investidos agrupada por classe. Itens de
// Ações/FIIs são clicáveis e abrem a análise do ativo. Estado próprio: aberto/fechado
// e ticker selecionado.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatBRL, formatBRLCents } from "@/lib/domain/currency";
import type { Produto } from "@/lib/domain/dashboardMetrics";
import AssetAnalysisModal from "../AssetAnalysisModal";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Legend } from "./StatCards";

export function CompositionBar({
  investimentos,
  caixa,
  faturas,
  produtos,
  mobile = false,
}: {
  investimentos: number;
  caixa: number;
  faturas: number;
  produtos: Produto[];
  /** Modo celular: cabeçalho empilhado, valores sem centavos, toque maior. */
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // No celular os centavos só atrapalham a leitura em linhas estreitas.
  const fmt = mobile ? formatBRL : formatBRLCents;
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const ativos = investimentos + caixa;
  if (ativos <= 0) return null;
  const pInv = (investimentos / ativos) * 100;
  const pCash = (caixa / ativos) * 100;

  // Produtos agrupados por classe, cada grupo e cada item ordenados por valor.
  const grupos = Object.values(
    produtos.reduce<Record<string, { grupo: string; total: number; itens: Produto[] }>>((acc, p) => {
      (acc[p.grupo] ??= { grupo: p.grupo, total: 0, itens: [] });
      acc[p.grupo].total += p.valor;
      acc[p.grupo].itens.push(p);
      return acc;
    }, {}),
  )
    .map((g) => ({ ...g, itens: [...g.itens].sort((a, b) => b.valor - a.valor) }))
    .sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader>
        <div
          className={
            mobile ? "space-y-0.5" : "flex items-baseline justify-between"
          }
        >
          <CardTitle className="text-sm">Composição do patrimônio</CardTitle>
          <span className="text-muted-foreground block text-xs">ativos {fmt(ativos)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-secondary flex h-3 w-full overflow-hidden rounded-full">
          <div style={{ width: `${pInv}%`, background: "var(--primary)" }} />
          <div style={{ width: `${pCash}%`, background: "var(--positive)" }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <Legend color="var(--primary)" label="Investimentos" value={fmt(investimentos)} />
          <Legend color="var(--positive)" label="Caixa" value={fmt(caixa)} />
          {faturas > 0 && (
            <span className="text-muted-foreground">
              Dívida de cartão:{" "}
              <span className="text-destructive tabular-nums">− {fmt(faturas)}</span>
            </span>
          )}
        </div>

        {produtos.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className={cn("text-muted-foreground -ml-2 gap-1.5", mobile && "h-11 text-sm")}
            >
              {open ? (
                <ChevronDown className="size-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-3.5" aria-hidden="true" />
              )}
              {open ? "Ocultar" : "Ver"} produtos investidos ({produtos.length})
            </Button>

            {open && (
              <div className="mt-3 space-y-4">
                {grupos.map((g) => (
                  <div key={g.grupo}>
                    <div className="text-muted-foreground mb-1.5 flex items-baseline justify-between text-xs font-medium">
                      <span>{g.grupo}</span>
                      <span className="tabular-nums">{fmt(g.total)}</span>
                    </div>
                    <div className="overflow-hidden rounded-lg border">
                      {g.itens.map((p) => {
                        const pctPatr = investimentos > 0 ? (p.valor / investimentos) * 100 : 0;
                        // Ações/FIIs têm ticker da B3 → clicáveis para abrir a análise.
                        const clickable = g.grupo === "Ações/FIIs";
                        return (
                          <div
                            key={p.id}
                            {...(clickable
                              ? {
                                  role: "button" as const,
                                  tabIndex: 0,
                                  onClick: () => setSelectedTicker(p.nome),
                                  onKeyDown: (e: React.KeyboardEvent) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setSelectedTicker(p.nome);
                                    }
                                  },
                                }
                              : {})}
                            className={`flex items-center justify-between gap-3 border-t px-3 text-sm first:border-t-0 ${
                              mobile ? "py-3" : "py-2"
                            } ${
                              clickable
                                ? "hover:bg-secondary/60 focus-visible:bg-secondary/60 cursor-pointer outline-none"
                                : ""
                            }`}
                            title={clickable ? `Ver análise de ${p.nome}` : undefined}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-medium">{p.nome}</span>
                                {clickable && (
                                  <ChevronRight
                                    className="text-muted-foreground size-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              {p.detalhe && (
                                <div className="text-muted-foreground text-xs">{p.detalhe}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="tabular-nums">{fmt(p.valor)}</div>
                              <div className="text-muted-foreground text-xs tabular-nums">
                                {pctPatr.toFixed(0)}%
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>

      {selectedTicker && (
        <AssetAnalysisModal
          key={selectedTicker}
          ticker={selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </Card>
  );
}
