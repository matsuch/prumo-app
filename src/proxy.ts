import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Gate de autenticação: usuários não logados (inclusive anônimos) são
// redirecionados para /login. Ver src/lib/supabase/middleware.ts.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Todas as rotas, exceto assets estáticos do Next e arquivos de imagem.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
