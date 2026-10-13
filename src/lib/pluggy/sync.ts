// MODO DEMO: a sincronização com o Open Finance (Pluggy) fica na versão privada.
// Aqui as "conexões" são fictícias e já vêm sincronizadas; sincronizar só atualiza
// a hora da última sincronização, para a interface se comportar como no app real.
import { getPluggyItems, savePluggyItem } from "@/lib/supabase/pluggy";

export class ItemNotFoundError extends Error {
  constructor(message = "Item não encontrado") {
    super(message);
    this.name = "ItemNotFoundError";
  }
}

export interface SyncCounts {
  positions: number;
  accounts: number;
  bills: number;
  transactions: number;
}

export interface SyncAllResult extends SyncCounts {
  items: number;
  expired: number;
  failed: { itemId: string; error: string }[];
}

export async function syncPluggyItem(itemId: string): Promise<SyncCounts> {
  const item = (await getPluggyItems()).find((i) => i.itemId === itemId);
  if (!item) throw new ItemNotFoundError();
  await savePluggyItem({
    itemId,
    connectorName: item.connectorName,
    status: item.status,
    executionStatus: item.executionStatus,
    lastSuccessfulUpdateAt: new Date().toISOString(),
  });
  return { positions: 0, accounts: 0, bills: 0, transactions: 0 };
}

export async function syncAllPluggyItems(): Promise<SyncAllResult> {
  const items = await getPluggyItems();
  for (const item of items) await syncPluggyItem(item.itemId);
  return { items: items.length, positions: 0, accounts: 0, bills: 0, transactions: 0, expired: 0, failed: [] };
}
