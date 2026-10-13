import AppPage from "@/components/AppPage";
import PrivateModule from "@/components/PrivateModule";
import { createClient } from "@/lib/supabase/server";

// MODO DEMO: a conexão com o Open Finance (Pluggy) fica na versão privada. Os
// cartões, contas e a previdência do demo já vêm de uma conexão fictícia.
export default async function ConectarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  return (
    <AppPage
      email={email}
      title="Conexões"
      description="Open Finance via Meu Pluggy."
      mainClassName="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <PrivateModule title="Conexão bancária desativada no demo">
        <p>
          No app real, as contas, os cartões e os investimentos chegam por Open Finance e são
          sincronizados todo dia por uma rotina agendada. O PRUMO nunca guarda credenciais
          bancárias.
        </p>
        <p>
          Aqui os dados vêm de uma conexão fictícia (&quot;Banco Demo&quot;), já sincronizada: veja
          as telas de Cartões e o Dashboard.
        </p>
      </PrivateModule>
    </AppPage>
  );
}
