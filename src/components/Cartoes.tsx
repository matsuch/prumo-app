"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatBRLCents } from "@/lib/domain/currency";
import {
  getPluggyAccounts,
  getPluggyBills,
  getPluggyItems,
  getPluggyTransactions,
  PLUGGY_STATUS_EXPIRED,
  type StoredAccount,
  type StoredBill,
  type StoredItem,
  type StoredTransaction,
} from "@/lib/supabase/pluggy";
import { syncAllPluggyItems } from "@/lib/pluggy/sync";
import { Button } from "./ui/button";
import {
  dedupeAccounts,
  dedupeBills,
  dedupeTransactions,
  faturaAtual,
  faturasDoCartao,
  janelaFaturaAtual,
  porCategoria,
  porEstabelecimento,
  totalGasto,
  transacoesFaturaAtual,
  type Agrupado,
} from "@/lib/domain/cards";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";

export default function Cartoes() {
  const isMobile = useIsMobile();
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [bills, setBills] = useState<StoredBill[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [items, setItems] = useState<StoredItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [acc, bll, txs, its] = await Promise.all([
      getPluggyAccounts(),
      getPluggyBills(),
      getPluggyTransactions(),
      getPluggyItems(),
    ]);
    setAccounts(acc);
    setBills(bll);
    setTransactions(txs);
    setItems(its);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar cartões");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const sincronizar = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const r = await syncAllPluggyItems();
      await load();
      const extras = [
        r.expired > 0 ? `${r.expired} conexão(ões) expirada(s) — reconecte` : null,
        r.failed.length > 0 ? `${r.failed.length} com falha` : null,
      ].filter(Boolean);
      setMessage(
        `Sincronizado: ${r.transactions} transações, ${r.bills} faturas, ${r.accounts} contas/cartões.` +
          (extras.length ? ` (${extras.join(", ")})` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [load]);

  // Dedupe: o mesmo cartão pode estar conectado via mais de um item Pluggy.
  const cartoes = useMemo(
    () => dedupeAccounts(accounts).filter((a) => a.tipo === "CREDIT"),
    [accounts],
  );
  // Conexões expiradas (item some do Pluggy → 404): o cartão continua visível
  // com os últimos dados, mas sinalizado para reconectar.
  const expiredItemIds = useMemo(
    () => new Set(items.filter((i) => i.status === PLUGGY_STATUS_EXPIRED).map((i) => i.itemId)),
    [items],
  );
  const uniqueBills = useMemo(() => dedupeBills(bills), [bills]);
  const uniqueTx = useMemo(() => dedupeTransactions(transactions), [transactions]);

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (cartoes.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum cartão de crédito sincronizado ainda.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={sincronizar}
            disabled={syncing}
            className={cn(isMobile && "h-11 w-full px-5")}
          >
            {syncing ? "Sincronizando…" : "↻ Sincronizar agora"}
          </Button>
          <Button asChild variant="outline" className={cn(isMobile && "h-11 w-full px-5")}>
            <Link href="/conectar">Conectar Meu Pluggy →</Link>
          </Button>
        </div>
        {message && <p className="mt-3 text-xs text-positive">{message}</p>}
        {error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            ⚠ {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={sincronizar}
          disabled={syncing}
          className={cn(isMobile && "h-11 w-full px-5")}
        >
          {syncing ? "Sincronizando…" : "↻ Sincronizar agora"}
        </Button>
        {message && <span className="text-xs text-positive">{message}</span>}
        {error && (
          <span role="alert" className="text-xs text-destructive">
            ⚠ {error}
          </span>
        )}
      </div>

      {cartoes.map((card) => (
        <CartaoDetalhe
          key={card.externalId}
          card={card}
          bills={uniqueBills}
          transactions={uniqueTx.filter((t) => t.accountId === card.externalId)}
          expired={expiredItemIds.has(card.itemId)}
        />
      ))}

      <p className="border-t border pt-4 text-xs text-muted-foreground">
        Dados via{" "}
        <Link href="/conectar" className="text-primary hover:underline">
          Meu Pluggy
        </Link>
        . A sincronização puxa a atualização mais recente disponível no Open Finance.
      </p>
    </div>
  );
}

function CartaoDetalhe({
  card,
  bills,
  transactions,
  expired,
}: {
  card: StoredAccount;
  bills: StoredBill[];
  transactions: StoredTransaction[];
  expired: boolean;
}) {
  const fatura = faturaAtual(card, bills, transactions);
  const janela = janelaFaturaAtual(card, bills);
  const historico = faturasDoCartao(bills, card.externalId);
  // Composição da FATURA ATUAL: só as transações do ciclo aberto (React Compiler
  // memoiza automaticamente; evitamos useMemo com .sort, que ele não preserva).
  const txFatura = [...transacoesFaturaAtual(card, bills, transactions)].sort((a, b) =>
    (a.data ?? "") < (b.data ?? "") ? 1 : -1,
  );
  const categorias = porCategoria(txFatura);
  const estabelecimentos = porEstabelecimento(txFatura);
  const gasto = totalGasto(txFatura);
  // Data da última compra de fato feita no cartão — sinaliza o quão atualizada
  // está a integração do Pluggy (que costuma ter defasagem). Ignora as parcelas
  // futuras: a `data` de uma parcela seguinte é a data em que ela cai na fatura
  // (pode ser daqui a meses), não quando o cartão foi usado. Por isso só contam
  // as compras à vista / 1ª parcela (parcela nula ou 1) com data já ocorrida.
  const hoje = new Date().toISOString().slice(0, 10);
  const ultimoUso = transactions.reduce<string | null>((max, t) => {
    if (!t.data || t.data > hoje) return max;
    if (t.parcela != null && t.parcela !== 1) return max;
    return !max || t.data > max ? t.data : max;
  }, null);

  return (
    <section className="space-y-5 rounded-xl border border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{card.nome}</h2>
            {expired && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                conexão expirada
              </span>
            )}
          </div>
          {card.brand && <p className="text-xs text-muted-foreground">{card.brand}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            Fatura atual{fatura.estimadaPorSaldo ? " (estimada pelo saldo)" : ""}
          </p>
          <p className="text-xl font-semibold tabular-nums text-destructive">
            {formatBRLCents(fatura.valor)}
          </p>
          {fatura.vencimento && (
            <p className="text-xs text-muted-foreground">vence ~{formatDate(fatura.vencimento)}</p>
          )}
          {card.limiteDisponivel != null && (
            <p className="text-xs text-muted-foreground">
              limite disponível {formatBRLCents(card.limiteDisponivel)}
            </p>
          )}
        </div>
      </div>

      {expired && (
        <div className="-mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          A conexão deste cartão expirou no Meu Pluggy — os dados abaixo são os
          últimos sincronizados e não atualizam mais.{" "}
          <Link href="/conectar" className="font-medium underline">
            Reconectar
          </Link>{" "}
          para voltar a atualizar.
        </div>
      )}

      {(janela.inicio || janela.fim) && !fatura.estimadaPorSaldo && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Ciclo aberto: compras de {formatDate(janela.inicio)} a {formatDate(janela.fim)}.
        </p>
      )}

      {ultimoUso && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Cartão usado pela última vez em{" "}
          <span className="font-medium text-foreground">{formatDate(ultimoUso)}</span> — se você
          usou depois disso, o Pluggy ainda não sincronizou a compra.
        </p>
      )}

      {/* Histórico de faturas fechadas (o /bills só traz faturas já fechadas) */}
      {historico.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Histórico de faturas</h3>
          <div className="max-h-64 overflow-auto rounded-xl border border">
            <table className="w-full min-w-[26rem] text-sm">
              <tbody>
                {historico.map((b) => (
                  <tr key={b.externalId} className="border-t border first:border-t-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">Venc. {formatDate(b.dueDate)}</div>
                      {b.minimumPayment != null && (
                        <div className="text-xs text-muted-foreground">
                          mínimo {formatBRLCents(b.minimumPayment)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {formatBRLCents(b.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {txFatura.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <RankBars titulo="Gastos por categoria" itens={categorias} total={gasto} />
            <RankBars titulo="Estabelecimentos" itens={estabelecimentos} total={gasto} />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Lançamentos da fatura atual</h3>
              <span className="text-xs text-muted-foreground">
                {txFatura.length} gastos · {formatBRLCents(gasto)}
              </span>
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border border">
              <table className="w-full min-w-[26rem] text-sm">
                <tbody>
                  {txFatura.map((t) => (
                    <tr key={t.externalId} className="border-t border first:border-t-0">
                      <td className="px-3 py-2">
                        <div className="font-medium">
                          {t.estabelecimento ?? t.descricao}
                          {t.projetada && (
                            <span
                              className="ml-2 rounded-full border border bg-muted px-1.5 py-0.5 align-middle text-[10px] font-normal text-muted-foreground"
                              title="Parcela deste ciclo reconstruída: o Pluggy só entrega as parcelas depois que a fatura fecha."
                            >
                              parcela reconstruída
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(t.data)}
                          {t.categoria ? ` · ${t.categoria}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatBRLCents(t.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {transactions.length > 0 && txFatura.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum lançamento no ciclo aberto ainda — ou os dados do Pluggy estão defasados
          (rode uma sincronização no Meu Pluggy).
        </p>
      )}

      {transactions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sem transações sincronizadas para este cartão. Rode uma sincronização no Meu Pluggy.
        </p>
      )}
    </section>
  );
}

function RankBars({
  titulo,
  itens,
  total,
}: {
  titulo: string;
  itens: Agrupado[];
  total: number;
}) {
  const top = itens.slice(0, 8);
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{titulo}</h3>
      {top.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados.</p>
      ) : (
        <div className="space-y-2.5">
          {top.map((it) => {
            const pct = total > 0 ? (it.total / total) * 100 : 0;
            return (
              <div key={it.chave}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate" title={it.chave}>
                    {it.chave}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatBRLCents(it.total)} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "var(--primary)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const iso = value.length <= 10 ? `${value}T00:00:00Z` : value;
  return new Date(iso).toLocaleDateString("pt-BR");
}
