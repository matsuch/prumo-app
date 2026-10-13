import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Autorização compartilhada das rotas de API. O proxy (src/proxy.ts) NÃO protege
// /api: cada rota decide aqui se aceita o cron, uma sessão logada, ou ambos.

/**
 * `Authorization: Bearer $CRON_SECRET` (a Vercel injeta ao disparar o cron).
 * Sem CRON_SECRET configurado, recusa sempre — antes, `Bearer undefined` passava.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || !auth) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(auth);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Usuário logado de verdade (sessão anônima antiga não conta), ou null. */
export async function getSessionUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user && !user.is_anonymous ? user : null;
  } catch {
    return null;
  }
}

/** Cron OU sessão logada (endpoints de disparo manual pelo navegador). */
export async function isCronOrUser(request: Request): Promise<boolean> {
  return isCronRequest(request) || (await getSessionUser()) !== null;
}

export function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}
