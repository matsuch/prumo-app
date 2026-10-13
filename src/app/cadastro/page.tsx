import AppPage from "@/components/AppPage";
import Cadastro from "@/components/Cadastro";
import { parseAba } from "@/lib/cadastroAba";
import { createClient } from "@/lib/supabase/server";

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;
  const { aba } = await searchParams;

  return (
    <AppPage
      email={email}
      title="Cadastro"
      description="Tudo o que alimenta o dashboard: o orçamento do mês, seus investimentos e suas metas."
      mobileDescription={null}
      headerClassName="mb-6"
      mainClassName="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"
    >
      <Cadastro initialAba={parseAba(aba)} />
    </AppPage>
  );
}
