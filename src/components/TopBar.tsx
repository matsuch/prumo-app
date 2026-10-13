"use client";

// Barra de topo do desktop, em três zonas (padrão de apps de produto):
//
//   [marca] [navegação principal ........................] [Admin ▾]
//
// - Navegação principal: só DESTINOS de uso frequente, todos com o mesmo peso
//   visual e a página atual destacada. Não há mais botões de ação misturados com
//   links (antes "+ Cadastro"/"Metas"/"Memória" abriam modais ao lado das abas).
// - Admin: o que se configura de vez em quando (conexões, memória do Copiloto,
//   aparência) e a conta. Fica no canto direito, onde se espera "configurações".
//
// A lista de destinos vem de `mobile/nav.ts`, a mesma do celular.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import BrandMark from "./BrandMark";
import SignOutButton from "./SignOutButton";
import { Button } from "./ui/button";
import { ADMIN_ITEMS, PRIMARY_ITEMS, isActive } from "./mobile/nav";

export default function TopBar({ email }: { email: string | null }) {
  const pathname = usePathname();

  return (
    // flex-wrap: em janelas estreitas a barra quebra em linhas em vez de empurrar
    // a página para o lado (rolagem horizontal).
    <header className="bg-card flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-4 py-2.5">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
        <span aria-hidden="true" className="bg-primary grid size-7 place-items-center rounded-lg">
          <BrandMark className="text-primary-foreground size-4" />
        </span>
        PRUMO
      </Link>

      <nav aria-label="Navegação principal" className="flex flex-wrap items-center gap-1">
        {PRIMARY_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Button key={item.href} asChild variant={active ? "secondary" : "ghost"} size="sm">
              <Link href={item.href} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="ml-auto">
        <AdminMenu email={email} pathname={pathname} />
      </div>
    </header>
  );
}

function AdminMenu({ email, pathname }: { email: string | null; pathname: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const adminActive = ADMIN_ITEMS.some((i) => isActive(pathname, i.href));

  // Fecha ao clicar fora ou com Esc (devolvendo o foco ao botão).
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={buttonRef}
        variant={adminActive ? "secondary" : "ghost"}
        size="sm"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="admin-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Settings aria-hidden="true" />
        Admin
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </Button>

      {open && (
        <div
          id="admin-menu"
          className="bg-card absolute top-full right-0 z-50 mt-2 w-72 rounded-xl border p-1.5 shadow-xl"
        >
          <p className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs font-semibold tracking-wide uppercase">
            Configurações
          </p>
          <ul>
            {ADMIN_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "hover:bg-secondary focus-visible:bg-secondary flex items-center gap-3 rounded-lg px-2.5 py-2 outline-none",
                      active && "bg-secondary",
                    )}
                  >
                    <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      {item.hint && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.hint}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-1.5 flex items-center justify-between gap-3 border-t px-2.5 pt-2.5 pb-1">
            <span className="text-muted-foreground min-w-0 truncate text-xs" title={email ?? undefined}>
              {email ?? "Sessão anônima"}
            </span>
            <SignOutButton />
          </div>
        </div>
      )}
    </div>
  );
}
