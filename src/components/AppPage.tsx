"use client";

// Moldura das telas que existem nas duas interfaces.
//
// No DESKTOP entrega exatamente o mesmo markup de antes (TopBar + <main> com a
// classe da própria tela + cabeçalho); no CELULAR troca a moldura pelo MobileShell
// (topo fixo + barra de navegação inferior). O CONTEÚDO é o mesmo componente nos
// dois casos — nada é duplicado, só a moldura muda.

import TopBar from "./TopBar";
import MobileShell from "./mobile/MobileShell";
import { useIsMobile } from "@/lib/useIsMobile";

export default function AppPage({
  email,
  title,
  description,
  mobileTitle,
  mobileDescription,
  mobileAction,
  headerClassName = "mb-6",
  descriptionClassName = "text-muted-foreground mt-2 max-w-2xl text-sm",
  mainClassName = "w-full px-6 py-8",
  headerExtra,
  footer,
  children,
}: {
  email: string | null;
  title: string;
  description?: React.ReactNode;
  /** Título curto para o topo estreito do celular (padrão: o mesmo). */
  mobileTitle?: string;
  /** No celular a descrição pode ser encurtada — ou omitida com `null`. */
  mobileDescription?: React.ReactNode;
  mobileAction?: React.ReactNode;
  headerClassName?: string;
  descriptionClassName?: string;
  mainClassName?: string;
  /** Extras do cabeçalho desktop (ex.: link de voltar). */
  headerExtra?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const desc = mobileDescription === undefined ? description : mobileDescription;
    return (
      <MobileShell title={mobileTitle ?? title} email={email} action={mobileAction}>
        {desc && <p className="text-muted-foreground mb-4 text-sm">{desc}</p>}
        {children}
        {footer}
      </MobileShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar email={email} />
      <main className={mainClassName}>
        <header className={headerClassName}>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className={descriptionClassName}>{description}</p>}
          {headerExtra}
        </header>

        {children}

        {footer}
      </main>
    </div>
  );
}
