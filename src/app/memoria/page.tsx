import Memoria from "@/components/Memoria";
import AppPage from "@/components/AppPage";
import { createClient } from "@/lib/supabase/server";

// Memória do Copiloto em tela própria (menu Admin no desktop; seção Admin do
// "Mais" no celular).
export default async function MemoriaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  return (
    <AppPage
      email={email}
      title="Memória do Copiloto"
      mobileTitle="Memória"
      description="O que o Copiloto guardou sobre você entre as conversas."
      mainClassName="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6"
      headerClassName="mb-8"
    >
      <Memoria />
    </AppPage>
  );
}
