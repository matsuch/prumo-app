import { NextResponse, type NextRequest } from "next/server";
import { DEMO_VISITOR_COOKIE } from "@/lib/demo/visitor";

// MODO DEMO: não há login. Todo visitante entra direto como o usuário de
// demonstração; /login só devolve para o dashboard. Cada visitante ganha um id
// aleatório em cookie, que separa o estado dele no servidor (ver server.ts).
export async function updateSession(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  if (request.cookies.get(DEMO_VISITOR_COOKIE)) return NextResponse.next({ request });

  const visitor = crypto.randomUUID();
  request.cookies.set(DEMO_VISITOR_COOKIE, visitor); // já vale nesta requisição
  const response = NextResponse.next({ request });
  response.cookies.set(DEMO_VISITOR_COOKIE, visitor, {
    path: "/",
    httpOnly: false, // "Reiniciar demo" apaga pelo navegador
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
