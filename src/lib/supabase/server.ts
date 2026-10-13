import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { DemoStore, createDemoClient } from "@/lib/demo/fakeSupabase";
import { DEMO_VISITOR_COOKIE } from "@/lib/demo/visitor";

// MODO DEMO: no servidor, um store em memória POR VISITANTE (cookie criado no
// middleware), para o que um visitante grava (ex.: a lista de ações) não aparecer
// para outro. "Reiniciar demo" apaga o cookie e o visitante recomeça do zero.
// Guardamos poucos visitantes por instância; o mais antigo sai primeiro.
const MAX_VISITORS = 200;
const stores = new Map<string, DemoStore>();

function storeFor(visitor: string): DemoStore {
  let store = stores.get(visitor);
  if (store) {
    stores.delete(visitor); // reinsere no fim: mais recente
  } else {
    store = new DemoStore();
    if (stores.size >= MAX_VISITORS) stores.delete(stores.keys().next().value!);
  }
  stores.set(visitor, store);
  return store;
}

export async function createClient(): Promise<SupabaseClient<Database>> {
  const visitor = (await cookies()).get(DEMO_VISITOR_COOKIE)?.value ?? "sem-cookie";
  return createDemoClient(storeFor(visitor)) as unknown as SupabaseClient<Database>;
}
