import AppPage from "@/components/AppPage";
import Aparencia from "@/components/Aparencia";
import { createClient } from "@/lib/supabase/server";

export default async function AparenciaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  return (
    <AppPage
      email={email}
      title="Aparência"
      description="Está muito escuro? Ajuste as cores de fundo do app. As mudanças são aplicadas na hora e ficam salvas neste navegador — nada é enviado para o servidor."
      mobileDescription="Ajuste as cores de fundo do app. Fica salvo só neste aparelho."
      mainClassName="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <Aparencia />
    </AppPage>
  );
}
