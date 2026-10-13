import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { DemoStore, createDemoClient } from "@/lib/demo/fakeSupabase";

/** Cliente Supabase tipado, aceito tanto do browser quanto do servidor (SSR).
 * Os leitores de dados abaixo aceitam um `Supa` injetado para rodarem no
 * servidor. */
export type Supa = SupabaseClient<Database>;

// MODO DEMO: em vez do Supabase, um banco em memória com dados fictícios (ver
// src/lib/demo). Um único store por aba, salvo no localStorage do visitante.
let browserStore: DemoStore | null = null;

export function createClient(): Supa {
  browserStore ??= new DemoStore();
  return createDemoClient(browserStore) as unknown as Supa;
}
