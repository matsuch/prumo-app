import Cartoes from "@/components/Cartoes";
import AppPage from "@/components/AppPage";
import { createClient } from "@/lib/supabase/server";

export default async function CartoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  return (
    <AppPage
      email={email}
      title="Cartões"
      description="Faturas a vencer, gastos por categoria e por estabelecimento dos seus cartões de crédito conectados via Open Finance."
      mobileDescription="Faturas a vencer e gastos por categoria dos cartões conectados."
    >
      <Cartoes />
    </AppPage>
  );
}
