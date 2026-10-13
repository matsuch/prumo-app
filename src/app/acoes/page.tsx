import AppPage from "@/components/AppPage";
import Acoes from "@/components/Acoes";
import { createClient } from "@/lib/supabase/server";

export default async function AcoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  // Ticker inicial (ex.: vindo do link "Ver em Ações" da Inteligência).
  const { ticker } = await searchParams;
  const initialTicker = ticker?.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "") || undefined;

  return (
    <AppPage
      email={email}
      title="Ações"
      description="Sua lista de acompanhamento da B3. Compare a evolução das ações em 30/60/90 dias e 12 meses, no gráfico e na tabela. Independente da sua carteira."
      mobileDescription="Sua lista de acompanhamento da B3, independente da carteira."
      mainClassName="w-full px-4 py-8 sm:px-6 lg:px-8"
    >
      <Acoes initialTicker={initialTicker} />
    </AppPage>
  );
}
