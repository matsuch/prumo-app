import Historico from "@/components/Historico";
import AppPage from "@/components/AppPage";
import { createClient } from "@/lib/supabase/server";

export default async function HistoricoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  return (
    <AppPage
      email={email}
      title="Histórico"
      description="Registre o patrimônio ao longo do tempo e acompanhe a evolução real."
    >
      <Historico />
    </AppPage>
  );
}
