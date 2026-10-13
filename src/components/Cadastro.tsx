"use client";

// Cadastro: tudo o que o usuário informa ao app, numa tela só, em três abas.
//
//  - Mês:           o orçamento recorrente (entrada, gastos fixos, meta do mês).
//  - Investimentos: as posições (renda fixa, ações/FIIs e o que vem do Pluggy).
//  - Metas:         os objetivos de longo prazo.
//
// Abas em vez de uma página longa: cada grupo é uma tarefa diferente (fechar o
// mês vs. registrar um aporte vs. revisar objetivos), e a aba deixa só um deles
// na tela. A aba fica na URL (?aba=) para links diretos e para o "voltar" do
// navegador; a troca é local (replaceState), sem ida ao servidor.

import { useRef, useState } from "react";
import { CalendarDays, Target, Wallet, type LucideIcon } from "lucide-react";
import type { CadastroAba } from "@/lib/cadastroAba";
import { cn } from "@/lib/utils";
import Carteira, { CadastroMes } from "./Carteira";
import Metas from "./Metas";

const CADASTRO_ABAS: { id: CadastroAba; label: string; icon: LucideIcon; hint: string }[] =
  [
    {
      id: "mes",
      label: "Mês",
      icon: CalendarDays,
      hint: "Entrada, gastos fixos e quanto guardar neste mês.",
    },
    {
      id: "investimentos",
      label: "Investimentos",
      icon: Wallet,
      hint: "Suas posições em renda fixa, ações e FIIs.",
    },
    {
      id: "metas",
      label: "Metas",
      icon: Target,
      hint: "Objetivos de longo prazo e quanto aportar por mês para chegar lá.",
    },
  ];

export default function Cadastro({ initialAba }: { initialAba: CadastroAba }) {
  const [aba, setAba] = useState<CadastroAba>(initialAba);
  const tabRefs = useRef<Record<CadastroAba, HTMLButtonElement | null>>({
    mes: null,
    investimentos: null,
    metas: null,
  });

  // Links internos (ex.: "Cadastrar minha carteira →") trocam a aba via URL: a
  // página re-renderiza com outro initialAba e a aba acompanha.
  const [prevInitial, setPrevInitial] = useState(initialAba);
  if (initialAba !== prevInitial) {
    setPrevInitial(initialAba);
    setAba(initialAba);
  }

  function select(next: CadastroAba, focus = false) {
    setAba(next);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", next);
    window.history.replaceState(null, "", url);
    if (focus) tabRefs.current[next]?.focus();
  }

  // Setas/Home/End movem entre as abas (padrão WAI-ARIA de tabs).
  function onKeyDown(e: React.KeyboardEvent) {
    const i = CADASTRO_ABAS.findIndex((a) => a.id === aba);
    const last = CADASTRO_ABAS.length - 1;
    const to =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (to == null) return;
    e.preventDefault();
    select(CADASTRO_ABAS[to].id, true);
  }

  const atual = CADASTRO_ABAS.find((a) => a.id === aba)!;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Seções do cadastro"
        onKeyDown={onKeyDown}
        className="bg-secondary mb-2 grid grid-cols-3 gap-1 rounded-xl p-1 sm:inline-grid sm:w-auto"
      >
        {CADASTRO_ABAS.map((a) => {
          const selected = a.id === aba;
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              ref={(el) => {
                tabRefs.current[a.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${a.id}`}
              aria-selected={selected}
              aria-controls={`painel-${a.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(a.id)}
              className={cn(
                "flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                selected
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
              {a.label}
            </button>
          );
        })}
      </div>
      <p className="text-muted-foreground mb-6 text-sm">{atual.hint}</p>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`tab-${aba}`}>
        {aba === "mes" && <CadastroMes />}
        {aba === "investimentos" && <Carteira />}
        {aba === "metas" && <Metas />}
      </div>
    </div>
  );
}
