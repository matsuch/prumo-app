"use client";

import Dashboard from "./Dashboard";
import Chat from "./Chat";
import TopBar from "./TopBar";
import { useIsMobile } from "@/lib/useIsMobile";

export default function Workspace({ email }: { email: string | null }) {
  const isMobile = useIsMobile();

  // Celular: só o Dashboard, ocupando a tela inteira. Sem TopBar (a navegação
  // das outras telas fica no desktop) e sem Copiloto — o chat não entra nesta
  // primeira versão mobile. O Dashboard traz o próprio topo fixo, com a marca e
  // o botão de integração/atualização do Pluggy.
  if (isMobile) {
    return <Dashboard email={email} />;
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar email={email} />

      {/* Workspace: Dashboard (55%) + Copiloto (45%) */}
      <div className="grid min-h-0 flex-1 grid-cols-[55fr_45fr] gap-3 p-3">
        <section className="bg-card min-h-0 min-w-0 overflow-y-auto rounded-xl border p-5">
          <header className="mb-6">
            <h1 className="text-balance text-xl font-bold tracking-tight">
              Onde sua carteira chega daqui a 10 anos?
            </h1>
            <p className="text-muted-foreground mt-1 text-pretty text-sm">
              Patrimônio consolidado e projeção de longo prazo pelas suas posições reais.
            </p>
          </header>
          <Dashboard />
        </section>

        <aside className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 min-w-0 flex-1">
            <Chat fill />
          </div>
        </aside>
      </div>
    </div>
  );
}
