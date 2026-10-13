"use client";

// Barra de navegação inferior do mobile: quatro destinos do dia a dia + "Mais".
// Fica fixa no rodapé (alcance do polegar), marca a tela atual e respeita a área
// segura do aparelho. O conteúdo das telas reserva o espaço dela (ver MobileShell),
// então ela nunca cobre nada.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import MoreSheet from "./MoreSheet";
import { ADMIN_ITEMS, EXPLORE_ITEMS, TAB_ITEMS, isActive } from "./nav";

/** Altura da barra (sem a área segura) — o MobileShell usa para reservar espaço. */
export const TAB_BAR_HEIGHT = "4rem";

export default function MobileTabBar({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // "Mais" acende quando a tela atual veio de dentro dele.
  const moreActive = [...EXPLORE_ITEMS, ...ADMIN_ITEMS].some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/85"
      >
        <ul className="flex items-stretch">
          {TAB_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} aria-hidden="true" />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                moreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal
                className={cn("size-5", moreActive && "stroke-[2.5]")}
                aria-hidden="true"
              />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && <MoreSheet email={email} onClose={() => setMoreOpen(false)} />}
    </>
  );
}
