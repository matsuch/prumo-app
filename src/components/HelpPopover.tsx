"use client";

// Ícone de ajuda (?) discreto ao lado de um título. Ao acionar, abre um pequeno
// popover com a explicação. Sem dependência nova: posiciona com `fixed` + clamp no
// viewport (fica na tela em qualquer coluna/breakpoint) e fecha ao clicar fora,
// rolar a página ou apertar Esc.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const WIDTH = 288; // 18rem

export default function HelpPopover({
  label,
  title,
  children,
}: {
  label: string; // rótulo acessível do botão (ex.: "Como calculamos o rendimento?")
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(margin, r.left), window.innerWidth - WIDTH - margin);
    setPos({ top: r.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        // `after:` cria uma área de toque de ~40px sem ocupar espaço no layout.
        className="text-muted-foreground hover:text-foreground hover:border-foreground/40 border-border relative flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none font-semibold transition-colors after:absolute after:-inset-3 after:content-['']"
      >
        ?
      </button>
      {open && pos && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label={title}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: WIDTH }}
            className="bg-card z-50 max-w-[calc(100vw-1rem)] rounded-lg border p-3 text-left shadow-xl"
          >
            <p className="mb-1.5 text-sm font-semibold tracking-tight">{title}</p>
            <div className="text-muted-foreground space-y-2 text-xs leading-relaxed">{children}</div>
          </div>
        </>
      )}
    </>
  );
}
