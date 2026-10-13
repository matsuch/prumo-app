"use client";

// Bottom sheet: painel que sobe pela borda inferior da tela. É o padrão certo no
// celular para menus e formulários curtos — nasce onde o polegar está, não tampa
// a tela inteira e fecha arrastando/tocando fora.
//
// Usado pelo menu "Mais" da navegação e pelos formulários de nova posição.

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BottomSheet({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Ações fixas no rodapé (ficam acima do teclado, sempre alcançáveis). */
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    // Trava a rolagem do fundo enquanto o sheet está aberto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "bg-card flex max-h-[88dvh] w-full flex-col rounded-t-2xl border-t shadow-2xl outline-none",
          "animate-in slide-in-from-bottom duration-200",
        )}
      >
        {/* Alça: afirma que dá para arrastar/fechar. */}
        <div className="flex shrink-0 justify-center pt-2.5 pb-1">
          <span aria-hidden="true" className="bg-border h-1 w-10 rounded-full" />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground -mr-1 grid size-10 shrink-0 place-items-center rounded-lg"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Conteúdo rolável: o teclado do celular encolhe a área e o campo em foco
            continua alcançável. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{children}</div>

        <div
          className={cn(
            "shrink-0 px-4 pt-3",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
            footer && "bg-card border-t",
          )}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
