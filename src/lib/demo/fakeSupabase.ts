// Supabase de mentira para o modo demo: um banco em memória com a mesma API
// encadeável que o app usa (from().select().eq().order()…), mais um auth que
// sempre devolve o usuário de demonstração.
//
// As telas não sabem que estão no demo: os leitores de src/lib/supabase/* chamam
// este cliente como chamariam o de verdade. No navegador o estado fica salvo no
// localStorage (cada visitante tem a sua cópia da carteira fictícia); no servidor
// fica na memória do processo, com limite de linhas por tabela.

import { buildSeed, type DemoTables } from "./seed";
import { DEMO_VISITOR_COOKIE } from "./visitor";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;
type Result = { data: unknown; error: { message: string; code?: string } | null; count?: number };

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@prumo.app",
  is_anonymous: false,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2025-01-01T00:00:00.000Z",
};

const STORAGE_KEY = "prumo-demo-v1";

const SERVER_ROW_LIMIT = 500;
const isBrowser = typeof window !== "undefined";

export class DemoStore {
  tables: DemoTables;

  constructor() {
    this.tables = this.load() ?? buildSeed(DEMO_USER.id);
  }

  private load(): DemoTables | null {
    if (!isBrowser) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DemoTables) : null;
    } catch {
      return null;
    }
  }

  persist() {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tables));
    } catch {
      // sem storage (aba anônima, cota): o demo segue só em memória
    }
  }

  reset() {
    this.tables = buildSeed(DEMO_USER.id);
    if (!isBrowser) return;
    // Sem o cookie, o middleware cria outro id e o servidor também recomeça.
    document.cookie = `${DEMO_VISITOR_COOKIE}=; Max-Age=0; path=/`;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // idem
    }
  }

  table(name: string): Row[] {
    if (!this.tables[name]) this.tables[name] = [];
    return this.tables[name];
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a as number | string) < (b as number | string) ? -1 : 1;
}

function project(row: Row, columns: string): Row {
  const cols = columns.split(",").map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0 || cols.includes("*")) return { ...row };
  const out: Row = {};
  for (const c of cols) out[c] = row[c];
  return out;
}

class DemoQuery implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private filters: Filter[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private from_ = 0;
  private to_ = Infinity;
  private payload: Row[] = [];
  private patch: Row = {};
  private conflict: string[] = ["id"];
  private columns = "*";
  private returning = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(
    private store: DemoStore,
    private name: string,
  ) {}

  // --- operações
  select(columns = "*") {
    if (this.op === "select") this.columns = columns;
    else this.returning = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    if (opts?.onConflict) this.conflict = opts.onConflict.split(",").map((c) => c.trim());
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.patch = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }

  // --- filtros
  eq(col: string, v: unknown) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  neq(col: string, v: unknown) {
    this.filters.push((r) => r[col] !== v);
    return this;
  }
  gt(col: string, v: unknown) {
    this.filters.push((r) => compare(r[col], v) > 0 && r[col] != null);
    return this;
  }
  gte(col: string, v: unknown) {
    this.filters.push((r) => compare(r[col], v) >= 0 && r[col] != null);
    return this;
  }
  lt(col: string, v: unknown) {
    this.filters.push((r) => compare(r[col], v) < 0);
    return this;
  }
  lte(col: string, v: unknown) {
    this.filters.push((r) => compare(r[col], v) <= 0);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  is(col: string, v: unknown) {
    this.filters.push((r) => (r[col] ?? null) === v);
    return this;
  }
  match(obj: Row) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }

  // --- forma do resultado
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.to_ = this.from_ + n - 1;
    return this;
  }
  range(from: number, to: number) {
    this.from_ = from;
    this.to_ = to;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private matches(r: Row) {
    return this.filters.every((f) => f(r));
  }

  private withDefaults(v: Row): Row {
    const now = new Date().toISOString();
    return { id: uuid(), user_id: DEMO_USER.id, created_at: now, updated_at: now, ...v };
  }

  private guardSize(rows: Row[]): Result | null {
    if (!isBrowser && rows.length > SERVER_ROW_LIMIT) {
      return { data: null, error: { message: "Limite de dados do demo atingido." } };
    }
    return null;
  }

  private execute(): Result {
    const rows = this.store.table(this.name);
    let result: Row[] = [];

    switch (this.op) {
      case "select": {
        result = rows.filter((r) => this.matches(r));
        for (const { col, asc } of [...this.orders].reverse()) {
          result = [...result].sort((a, b) => (asc ? 1 : -1) * compare(a[col], b[col]));
        }
        result = result.slice(this.from_, this.to_ + 1).map((r) => project(r, this.columns));
        break;
      }
      case "insert": {
        result = this.payload.map((v) => this.withDefaults(v));
        rows.push(...result);
        break;
      }
      case "upsert": {
        for (const v of this.payload) {
          const full: Row = { user_id: DEMO_USER.id, ...v };
          const hit = rows.find((r) => this.conflict.every((c) => r[c] === full[c]));
          if (hit) {
            Object.assign(hit, v);
            result.push(hit);
          } else {
            const row = this.withDefaults(v);
            rows.push(row);
            result.push(row);
          }
        }
        break;
      }
      case "update": {
        result = rows.filter((r) => this.matches(r));
        for (const r of result) Object.assign(r, this.patch);
        break;
      }
      case "delete": {
        result = rows.filter((r) => this.matches(r));
        this.store.tables[this.name] = rows.filter((r) => !this.matches(r));
        break;
      }
    }

    if (this.op !== "select") {
      const tooBig = this.guardSize(this.store.table(this.name));
      if (tooBig) return tooBig;
      this.store.persist();
      if (!this.returning) return { data: null, error: null };
      result = result.map((r) => ({ ...r }));
    }

    if (this.mode === "many") return { data: result, error: null, count: result.length };
    if (result.length === 1) return { data: result[0], error: null };
    if (result.length === 0 && this.mode === "maybe") return { data: null, error: null };
    return {
      data: null,
      error: { message: `Esperava 1 linha em ${this.name}, veio ${result.length}.`, code: "PGRST116" },
    };
  }
}

export function createDemoClient(store: DemoStore) {
  const session = { user: DEMO_USER, access_token: "demo", token_type: "bearer" };
  return {
    from: (table: string) => new DemoQuery(store, table),
    auth: {
      getUser: async () => ({ data: { user: DEMO_USER }, error: null }),
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { user: DEMO_USER, session }, error: null }),
      signOut: async () => {
        store.reset();
        return { error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
}
