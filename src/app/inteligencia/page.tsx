import AppPage from "@/components/AppPage";
import PrivateModule from "@/components/PrivateModule";
import { createClient } from "@/lib/supabase/server";

// MODO DEMO: a engine de inteligência de mercado é a parte privada do PRUMO.
export default async function InteligenciaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  return (
    <AppPage
      email={email}
      title="Inteligência de Mercado"
      mobileTitle="Inteligência"
      description="O que está movimentando a B3."
      descriptionClassName="text-muted-foreground mt-1 text-sm"
      mainClassName="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <PrivateModule title="Módulo disponível só na versão privada">
        <p>
          A engine de inteligência de mercado é o diferencial do PRUMO e não faz parte do código
          aberto. Na versão completa, um pipeline semanal coleta notícias, extrai eventos
          estruturados com IA, mapeia cada evento para os ativos da B3 afetados e mede a
          diferença entre a reação esperada e a reação real dos preços.
        </p>
        <p>
          Também avalia carteiras recomendadas publicadas por casas de análise com uma nota
          própria, e registra as previsões para medir a acurácia depois.
        </p>
      </PrivateModule>
    </AppPage>
  );
}
