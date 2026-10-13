"use client";

// Moldura de TODAS as telas mobile: topo fixo (marca ou título da tela + uma ação
// opcional), conteúdo rolável e a barra de navegação inferior.
//
// O conteúdo reserva a altura da barra no padding de baixo — a navegação nunca
// cobre o que está sendo lido, e a rolagem termina acima dela.

import BrandMark from "../BrandMark";
import MobileTabBar from "./MobileTabBar";

export default function MobileShell({
  title,
  description,
  brand = false,
  action,
  busy = false,
  email,
  children,
}: {
  title: string;
  description?: string;
  /** Tela inicial: mostra a marca no lugar do título. */
  brand?: boolean;
  /** Ação principal da tela, à direita do topo (ex.: atualizar o Pluggy). */
  action?: React.ReactNode;
  /** Barra fina de progresso sob o topo (ex.: sincronização em andamento). */
  busy?: boolean;
  email: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col overflow-x-clip">
      {/* env(safe-area-inset-*): com viewport-fit=cover a página vai até as bordas
          do aparelho; as margens de segurança evitam conteúdo sob o notch. */}
      <header className="bg-card/95 sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex min-h-[3.25rem] items-center gap-3 py-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
          {brand ? (
            <span className="flex items-center gap-2 font-semibold tracking-tight">
              <span
                aria-hidden="true"
                className="bg-primary grid size-8 place-items-center rounded-lg"
              >
                <BrandMark className="text-primary-foreground size-4" />
              </span>
              {title}
            </span>
          ) : (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold tracking-tight">{title}</h1>
            </div>
          )}
          {action && <div className="ml-auto shrink-0">{action}</div>}
        </div>
        {/* Estado de carregamento explícito, sem mexer no layout. */}
        <div aria-hidden="true" className="h-0.5 w-full overflow-hidden">
          {busy && <div className="bg-primary h-full w-full animate-pulse" />}
        </div>
      </header>

      <main className="w-full flex-1 pt-4 pb-[calc(4rem+env(safe-area-inset-bottom)+1.5rem)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {description && <p className="text-muted-foreground mb-4 text-sm">{description}</p>}
        {children}
      </main>

      <MobileTabBar email={email} />
    </div>
  );
}
