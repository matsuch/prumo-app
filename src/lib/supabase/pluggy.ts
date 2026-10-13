import { createClient, type Supa } from "./client";
import { ensureSession } from "./carteira";
import type {
  PluggyAccount,
  PluggyBill,
  PluggyPosition,
  PluggyTransaction,
} from "@/lib/pluggy/normalize";

export interface StoredPosition extends PluggyPosition {
  categoria: string;
  itemId: string;
}

export interface StoredAccount extends PluggyAccount {
  itemId: string;
}

export interface StoredBill extends PluggyBill {
  itemId: string;
}

export interface StoredTransaction extends PluggyTransaction {
  itemId: string;
}

export interface StoredItem {
  id: string;
  itemId: string;
  connectorName: string | null;
  status: string | null;
  executionStatus: string | null;
  lastSuccessfulUpdateAt: string | null;
  lastSyncedAt: string | null;
}

export interface SyncItemPayload {
  itemId: string;
  connectorName?: string | null;
  status?: string | null;
  executionStatus?: string | null;
  lastSuccessfulUpdateAt?: string | null;
}

export async function getPluggyItems(): Promise<StoredItem[]> {
  await ensureSession();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pluggy_items")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    connectorName: row.connector_name,
    status: row.status,
    executionStatus: row.execution_status,
    lastSuccessfulUpdateAt: row.last_successful_update_at,
    lastSyncedAt: row.last_synced_at,
  }));
}

export async function savePluggyItem(item: SyncItemPayload): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("pluggy_items").upsert(
    {
      item_id: item.itemId,
      connector_name: item.connectorName ?? null,
      status: item.status ?? null,
      execution_status: item.executionStatus ?? null,
      last_successful_update_at: item.lastSuccessfulUpdateAt ?? null,
      last_synced_at: now,
    },
    { onConflict: "user_id,item_id" },
  );

  if (error) throw error;
}

// Marca uma conexão como expirada (item some do lado do Pluggy → 404) sem
// apagar os dados: os cartões continuam visíveis, só sinalizados para reconectar.
export const PLUGGY_STATUS_EXPIRED = "EXPIRED";

export async function markPluggyItemExpired(itemId: string): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const { error } = await supabase
    .from("pluggy_items")
    .update({ status: PLUGGY_STATUS_EXPIRED, last_synced_at: new Date().toISOString() })
    .eq("item_id", itemId);
  if (error) throw error;
}

export async function removePluggyItem(itemId: string): Promise<void> {
  await ensureSession();
  const supabase = createClient();
  const [itemDelete, positionsDelete, accountsDelete, billsDelete, txDelete] = await Promise.all([
    supabase.from("pluggy_items").delete().eq("item_id", itemId),
    supabase.from("pluggy_positions").delete().eq("item_id", itemId),
    supabase.from("pluggy_accounts").delete().eq("item_id", itemId),
    supabase.from("pluggy_bills").delete().eq("item_id", itemId),
    supabase.from("pluggy_transactions").delete().eq("item_id", itemId),
  ]);

  if (itemDelete.error) throw itemDelete.error;
  if (positionsDelete.error) throw positionsDelete.error;
  if (accountsDelete.error) throw accountsDelete.error;
  if (billsDelete.error) throw billsDelete.error;
  if (txDelete.error) throw txDelete.error;
}

export async function getPluggyPositions(db?: Supa): Promise<StoredPosition[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const { data, error } = await supabase
    .from("pluggy_positions")
    .select("*")
    .order("valor_atual", { ascending: false });

  if (error) throw error;

  // Deduplica por external_id: o mesmo investimento pode estar salvo sob mais de
  // um item Pluggy (mesma conta conectada 2x), o que dobraria o patrimônio.
  const seen = new Set<string>();
  const out: StoredPosition[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.external_id)) continue;
    seen.add(row.external_id);
    out.push({
      externalId: row.external_id,
      itemId: row.item_id,
      categoria: row.categoria,
      nome: row.nome,
      valorAtual: row.valor_atual,
      valorInvestido: row.valor_investido,
      rendimento: row.rendimento,
    });
  }
  return out;
}

export async function savePluggyPositions(
  itemId: string,
  positions: PluggyPosition[],
): Promise<void> {
  await ensureSession();
  const supabase = createClient();

  const cleared = await supabase.from("pluggy_positions").delete().eq("item_id", itemId);
  if (cleared.error) throw cleared.error;

  if (positions.length === 0) return;

  const rows = positions.map((position) => ({
    item_id: itemId,
    external_id: position.externalId,
    categoria: position.categoria,
    nome: position.nome,
    valor_atual: position.valorAtual,
    valor_investido: position.valorInvestido,
    rendimento: position.rendimento,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("pluggy_positions").insert(rows);
  if (error) throw error;
}

export async function getPluggyAccounts(db?: Supa): Promise<StoredAccount[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const { data, error } = await supabase
    .from("pluggy_accounts")
    .select("*")
    .order("tipo", { ascending: true })
    .order("saldo", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    externalId: row.external_id,
    itemId: row.item_id,
    tipo: row.tipo === "CREDIT" ? "CREDIT" : "BANK",
    nome: row.nome,
    saldo: row.saldo,
    limiteDisponivel: row.limite_disponivel,
    limiteTotal: row.limite_total,
    vencimento: row.vencimento,
    brand: row.brand,
  }));
}

export async function savePluggyAccounts(
  itemId: string,
  accounts: PluggyAccount[],
): Promise<void> {
  await ensureSession();
  const supabase = createClient();

  const cleared = await supabase.from("pluggy_accounts").delete().eq("item_id", itemId);
  if (cleared.error) throw cleared.error;

  if (accounts.length === 0) return;

  const rows = accounts.map((a) => ({
    item_id: itemId,
    external_id: a.externalId,
    tipo: a.tipo,
    nome: a.nome,
    saldo: a.saldo,
    limite_disponivel: a.limiteDisponivel,
    limite_total: a.limiteTotal,
    vencimento: a.vencimento,
    brand: a.brand,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("pluggy_accounts").insert(rows);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Faturas de cartão
// ---------------------------------------------------------------------------

export async function getPluggyBills(db?: Supa): Promise<StoredBill[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();
  const { data, error } = await supabase
    .from("pluggy_bills")
    .select("*")
    .order("due_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    externalId: row.external_id,
    itemId: row.item_id,
    accountId: row.account_id,
    dueDate: row.due_date,
    closingDate: row.closing_date,
    totalAmount: row.total_amount,
    minimumPayment: row.minimum_payment,
  }));
}

export async function savePluggyBills(itemId: string, bills: PluggyBill[]): Promise<void> {
  await ensureSession();
  const supabase = createClient();

  const cleared = await supabase.from("pluggy_bills").delete().eq("item_id", itemId);
  if (cleared.error) throw cleared.error;

  if (bills.length === 0) return;

  const rows = bills.map((b) => ({
    item_id: itemId,
    account_id: b.accountId,
    external_id: b.externalId,
    due_date: b.dueDate,
    closing_date: b.closingDate,
    total_amount: b.totalAmount,
    minimum_payment: b.minimumPayment,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("pluggy_bills").insert(rows);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Transações de cartão
// ---------------------------------------------------------------------------

// O PostgREST corta a resposta em 1000 linhas por padrão, sem erro nenhum: com
// mais de um cartão conectado o histórico antigo sumia silenciosamente (e com
// ele as faturas passadas). Paginamos por `range` até acabar.
const PAGE = 1000;

export async function getPluggyTransactions(db?: Supa): Promise<StoredTransaction[]> {
  const supabase = db ?? createClient();
  if (!db) await ensureSession();

  const fetchPage = async (from: number) => {
    const { data, error } = await supabase
      .from("pluggy_transactions")
      .select("*")
      .order("data", { ascending: false })
      .order("external_id", { ascending: true }) // desempate estável entre páginas
      .range(from, from + PAGE - 1);
    if (error) throw error;
    return data ?? [];
  };

  const rows: Awaited<ReturnType<typeof fetchPage>> = [];
  for (let from = 0; ; from += PAGE) {
    const page = await fetchPage(from);
    rows.push(...page);
    if (page.length < PAGE) break;
  }

  return rows.map((row) => ({
    externalId: row.external_id,
    itemId: row.item_id,
    accountId: row.account_id,
    descricao: row.descricao,
    categoria: row.categoria,
    estabelecimento: row.estabelecimento,
    valor: row.valor,
    data: row.data,
    tipo: row.tipo,
    parcela: row.parcela ?? null,
    totalParcelas: row.total_parcelas ?? null,
  }));
}

export async function savePluggyTransactions(
  itemId: string,
  transactions: PluggyTransaction[],
): Promise<void> {
  await ensureSession();
  const supabase = createClient();

  const cleared = await supabase.from("pluggy_transactions").delete().eq("item_id", itemId);
  if (cleared.error) throw cleared.error;

  if (transactions.length === 0) return;

  const rows = transactions.map((t) => ({
    item_id: itemId,
    account_id: t.accountId,
    external_id: t.externalId,
    descricao: t.descricao,
    categoria: t.categoria,
    estabelecimento: t.estabelecimento,
    valor: t.valor,
    data: t.data,
    tipo: t.tipo,
    parcela: t.parcela,
    total_parcelas: t.totalParcelas,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("pluggy_transactions").insert(rows);
  if (error) throw error;
}
