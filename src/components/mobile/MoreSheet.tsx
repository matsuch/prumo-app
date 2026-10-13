"use client";

// Menu "Mais": os destinos ocasionais (Explorar), a configuração (Admin) e a
// conta, em um bottom sheet. Cada item é
// uma linha de 56px — alvo de toque generoso, com ícone, rótulo e uma frase que
// explica para que serve (o usuário não precisa adivinhar pelo nome).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import SignOutButton from "../SignOutButton";
import BottomSheet from "./BottomSheet";
import { ADMIN_ITEMS, EXPLORE_ITEMS, isActive, type NavItem } from "./nav";

export default function MoreSheet({
  email,
  onClose,
}: {
  email: string | null;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <BottomSheet
      title="Mais"
      description="Outras telas do PRUMO"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground min-w-0 truncate text-xs" title={email ?? undefined}>
            {email ?? "PRUMO"}
          </span>
          <SignOutButton className="h-11 px-5" />
        </div>
      }
    >
      <MoreGroup title="Explorar" items={EXPLORE_ITEMS} pathname={pathname} onClose={onClose} />
      <MoreGroup title="Admin" items={ADMIN_ITEMS} pathname={pathname} onClose={onClose} />
    </BottomSheet>
  );
}

function MoreGroup({
  title,
  items,
  pathname,
  onClose,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  onClose: () => void;
}) {
  return (
    <section className="pb-2">
      <h3 className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <ul>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-lg px-2 py-2",
                  active && "bg-secondary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg",
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.label}</span>
                  {item.hint && (
                    <span className="text-muted-foreground block truncate text-xs">{item.hint}</span>
                  )}
                </span>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
