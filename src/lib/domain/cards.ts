import type { StoredAccount, StoredBill, StoredTransaction } from "@/lib/supabase/pluggy";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Remove duplicatas por chave, preservando a primeira ocorrência. Usado porque o
// mesmo cartão/conta pode estar conectado via mais de um item Pluggy (mesmo
// externalId em item_ids diferentes) — sem isso, saldos e faturas contam em dobro.
export function dedupeBy<T>(list: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export function dedupeAccounts(accounts: StoredAccount[]): StoredAccount[] {
  return dedupeBy(accounts, (a) => a.externalId);
}

export function dedupeBills(bills: StoredBill[]): StoredBill[] {
  return dedupeBy(bills, (b) => b.externalId);
}

export function dedupeTransactions(txs: StoredTransaction[]): StoredTransaction[] {
  return dedupeBy(txs, (t) => t.externalId);
}

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function addOneMonth(iso: string): string {
  return addMonths(iso, 1);
}

/** Diferença em meses entre dois meses yyyy-mm-01 (a − b). */
function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (ay - by) * 12 + (am - bm);
}

// Fatura fechada mais recente de um cartão (a última que o Pluggy fechou).
function ultimaFechada(card: StoredAccount, bills: StoredBill[]): StoredBill | null {
  const doCartao = bills
    .filter((b) => b.accountId === card.externalId && b.closingDate)
    .sort((a, b) => (a.closingDate! < b.closingDate! ? 1 : -1));
  return doCartao[0] ?? null;
}

export interface JanelaFatura {
  inicio: string | null; // fechamento da última fatura (início do ciclo aberto)
  fim: string | null; // próximo fechamento estimado
  vencimento: string | null; // vencimento estimado do ciclo aberto
}

// Janela do ciclo ABERTO: começa no fechamento da última fatura fechada e vai até
// o próximo fechamento (+1 mês). O /bills só traz faturas fechadas, então a fatura
// atual (que ainda vai fechar/vencer) precisa ser somada pelas transações do ciclo.
export function janelaFaturaAtual(card: StoredAccount, bills: StoredBill[]): JanelaFatura {
  const recente = ultimaFechada(card, bills);
  const inicio = recente?.closingDate ?? null;
  return {
    inicio,
    fim: inicio ? addOneMonth(inicio) : null,
    vencimento: recente?.dueDate ? addOneMonth(recente.dueDate) : card.vencimento ?? null,
  };
}

// ---------------------------------------------------------------------------
// Ciclos de fatura e reconstrução das parcelas do ciclo ABERTO.
//
// Só agrupar por DATA não fecha a conta com o app do banco, por dois motivos:
//
// 1. A data que o Pluggy dá a uma parcela não é a data da compra — é a data em
//    que ela cai na fatura, e ela muda de formato conforme o estágio: parcelas
//    já FATURADAS vêm datadas no início do ciclo (o fechamento anterior), e
//    parcelas FUTURAS vêm datadas no dia-do-mês da compra original. Quando esse
//    dia é anterior ao dia de fechamento (compra dia 01, cartão fecha dia 02), a
//    parcela cai um ciclo antes do correto numa filtragem por data pura.
// 2. As parcelas da fatura ABERTA ficam num ponto cego do Pluggy: elas não estão
//    em nenhuma fatura fechada (a fatura ainda não fechou) e também não vêm na
//    lista de parcelas futuras quando a data projetada já passou. Some com elas.
//
// Por isso montamos a fatura aberta por SÉRIE de parcelamento: quem tinha a
// parcela N no ciclo anterior tem a N+1 no ciclo aberto — se o Pluggy não a
// entregou, ela é reconstruída com o mesmo valor.
// ---------------------------------------------------------------------------

/** yyyy-mm-dd → índice absoluto do mês (ano*12 + mês). */
function mesIndex(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
}

function diaDoMes(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** Dia de fechamento do cartão, inferido das faturas (ex.: 2 → fecha todo dia 02). */
function diaFechamento(card: StoredAccount, bills: StoredBill[]): number | null {
  const recente = ultimaFechada(card, bills);
  return recente?.closingDate ? diaDoMes(recente.closingDate) : null;
}

/**
 * Índice do ciclo que COBRA uma data (o mês em que essa fatura fecha).
 * `projetada` marca parcelas seguintes (parcela > 1), cuja data é sintética: o
 * Pluggy usa o dia-do-mês da compra, que pode cair um dia antes do fechamento.
 */
function cicloDe(iso: string, dia: number, projetada: boolean): number {
  const limite = projetada ? Math.max(1, dia - 1) : dia;
  return mesIndex(iso) + (diaDoMes(iso) >= limite ? 1 : 0);
}

/** Identidade da compra parcelada: loja + nº de parcelas + valor + ciclo de origem. */
function serieDe(t: StoredTransaction, dia: number): string {
  const loja = (t.descricao ?? "")
    .replace(/\s+\d+\/\d+$/, "")
    .trim()
    .toLowerCase();
  const parcela = t.parcela ?? 1;
  const origem = cicloDe(t.data!, dia, parcela > 1) - (parcela - 1);
  return `${loja}|${t.totalParcelas}|${Math.round(t.valor)}|${origem}`;
}

export interface Lancamento extends StoredTransaction {
  /** true = parcela reconstruída: o Pluggy ainda não a entregou na fatura aberta. */
  projetada?: boolean;
}

/** Parcela reconstruída para o ciclo aberto, a partir da parcela do ciclo anterior. */
function projetarParcela(anterior: StoredTransaction, parcela: number, data: string): Lancamento {
  const total = anterior.totalParcelas ?? 1;
  const loja = (anterior.descricao ?? "").replace(/\s+\d+\/\d+$/, "").trim();
  return {
    ...anterior,
    externalId: `${anterior.externalId}-p${parcela}`,
    descricao: `${loja} ${parcela}/${total}`,
    data,
    parcela,
    projetada: true,
  };
}

// Lançamentos que caem na fatura atual: gastos (valor > 0) do ciclo aberto, com
// as parcelas do ciclo reconstruídas quando o Pluggy não as entregou.
export function transacoesFaturaAtual(
  card: StoredAccount,
  bills: StoredBill[],
  txs: StoredTransaction[],
): Lancamento[] {
  const { inicio, fim } = janelaFaturaAtual(card, bills);
  const dia = diaFechamento(card, bills);
  const gastos = txs.filter(
    (t) => t.accountId === card.externalId && t.valor > 0 && t.data != null,
  );

  // Sem fatura fechada conhecida não há ciclo para ancorar: filtra pela janela.
  if (dia == null || inicio == null || fim == null) {
    return gastos.filter(
      (t) => (inicio == null || t.data! >= inicio) && (fim == null || t.data! < fim),
    );
  }

  const ciclo = mesIndex(inicio) + 1; // o ciclo aberto fecha um mês após o último fechamento
  const cicloDaTx = (t: StoredTransaction) => cicloDe(t.data!, dia, (t.parcela ?? 1) > 1);

  const out: Lancamento[] = [];
  const series = new Map<string, StoredTransaction[]>();

  for (const t of gastos) {
    if ((t.totalParcelas ?? 1) <= 1) {
      // À vista: entra pela própria data.
      if (cicloDaTx(t) === ciclo) out.push(t);
      continue;
    }
    const chave = serieDe(t, dia);
    const lista = series.get(chave);
    if (lista) lista.push(t);
    else series.set(chave, [t]);
  }

  for (const lista of series.values()) {
    const total = lista[0].totalParcelas ?? 1;
    const parcelaDe = (t: StoredTransaction) => t.parcela ?? 1;
    // Parcela da série cobrada na ÚLTIMA fatura fechada — a âncora confiável.
    const anterior = lista
      .filter((t) => cicloDaTx(t) === ciclo - 1)
      .sort((a, b) => parcelaDe(b) - parcelaDe(a))[0];

    if (anterior) {
      const alvo = parcelaDe(anterior) + 1;
      if (alvo > total) continue; // parcelamento terminou na fatura anterior
      const real = lista.find((t) => parcelaDe(t) === alvo);
      out.push(real ?? projetarParcela(anterior, alvo, inicio));
      continue;
    }
    // Sem parcela no ciclo anterior: só entra se a COMPRA foi feita neste ciclo.
    const nova = lista.find((t) => parcelaDe(t) === 1 && cicloDaTx(t) === ciclo);
    if (nova) out.push(nova);
  }

  return out;
}

export interface FaturaAtual {
  valor: number;
  vencimento: string | null;
  fechamento: string | null;
  estimadaPorSaldo: boolean; // true quando não há transações e caímos no balance
}

// Valor da fatura ATUAL (ciclo aberto) somando as transações do ciclo. Se ainda
// não há transações sincronizadas para o cartão, cai no saldo do Pluggy (balance)
// como aproximação — mas isso costuma superestimar, então marcamos a flag.
export function faturaAtual(
  card: StoredAccount,
  bills: StoredBill[],
  txs: StoredTransaction[],
): FaturaAtual {
  const janela = janelaFaturaAtual(card, bills);
  const temTx = txs.some((t) => t.accountId === card.externalId);
  const valor = temTx
    ? transacoesFaturaAtual(card, bills, txs).reduce((s, t) => s + t.valor, 0)
    : card.saldo;
  return {
    valor,
    vencimento: janela.vencimento,
    fechamento: janela.fim,
    estimadaPorSaldo: !temTx,
  };
}

/** Primeiro dia do mês (yyyy-mm-01) de uma data ISO yyyy-mm-dd. */
function monthOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export interface FaturaDoMes {
  valor: number | null; // null = nenhuma fatura conhecida nesse mês
  estimada: boolean; // inclui o ciclo ABERTO (estimado por transações/saldo)
  fechada: boolean; // inclui fatura(s) já FECHADA(s) do histórico
  parcial: boolean; // inclui projeção de mês FUTURO (só o já comprometido)
}

/**
 * Fatura de um MÊS específico (yyyy-mm-01), somando todos os cartões. Por cartão,
 * na ordem de prioridade:
 * 1. fatura FECHADA com vencimento naquele mês → valor REAL (`fechada`);
 * 2. mês do vencimento do ciclo ABERTO → fatura atual estimada (`estimada`);
 * 3. mês FUTURO ainda sem fatura → projeta a janela do ciclo e soma só o que já
 *    está COMPROMETIDO naquele mês (parcelamentos lançados com data futura) —
 *    estimativa `parcial`; se nada estiver comprometido, o cartão não entra;
 * 4. nada disso → `valor` null (sem fatura conhecida no mês).
 * Assim, ao fechar a fatura de verdade (1) o valor real assume o lugar da
 * projeção (3). Base da navegação de mês no "Fluxo do mês".
 */
export function faturaDoMes(
  cartoes: StoredAccount[],
  bills: StoredBill[],
  txs: StoredTransaction[],
  mes: string,
): FaturaDoMes {
  let total = 0;
  let temAlgo = false;
  let estimada = false;
  let fechada = false;
  let parcial = false;

  for (const card of cartoes) {
    // 1) Fatura já FECHADA com vencimento nesse mês → valor real, tem prioridade.
    const closed = faturasDoCartao(bills, card.externalId).find(
      (b) => b.dueDate != null && monthOf(b.dueDate) === mes,
    );
    if (closed) {
      total += closed.totalAmount;
      temAlgo = true;
      fechada = true;
      continue;
    }
    // 2) Mês do vencimento do ciclo ABERTO → fatura atual (estimada por tx/saldo).
    const atual = faturaAtual(card, bills, txs);
    const mesAberto = atual.vencimento ? monthOf(atual.vencimento) : null;
    if (mesAberto === mes) {
      total += atual.valor;
      temAlgo = true;
      estimada = true;
      continue;
    }
    // 3) Mês FUTURO ainda sem fatura → projeta a janela do ciclo (avança N meses)
    //    e soma só o que já está comprometido: parcelamentos com data naquele ciclo.
    if (mesAberto != null && mes > mesAberto) {
      const { inicio, fim } = janelaFaturaAtual(card, bills);
      if (inicio && fim) {
        const n = monthDiff(mes, mesAberto);
        const ini = addMonths(inicio, n);
        const fimProj = addMonths(fim, n);
        const comprometido = txs
          .filter(
            (t) =>
              t.accountId === card.externalId &&
              t.valor > 0 &&
              t.data != null &&
              t.data >= ini &&
              t.data < fimProj,
          )
          .reduce((s, t) => s + t.valor, 0);
        if (comprometido > 0) {
          total += comprometido;
          temAlgo = true;
          parcial = true;
        }
      }
    }
  }

  return { valor: temAlgo ? total : null, estimada, fechada, parcial };
}

// Faturas fechadas de um cartão (histórico), da mais recente para a mais antiga.
export function faturasDoCartao(bills: StoredBill[], accountId: string): StoredBill[] {
  return bills
    .filter((b) => b.accountId === accountId)
    .sort((a, b) => ((a.dueDate ?? "") < (b.dueDate ?? "") ? 1 : -1));
}

export interface Agrupado {
  chave: string;
  total: number;
  qtd: number;
}

// Agrupa gastos (valor > 0 em cartão de crédito) por uma chave, ordenado por total desc.
function agrupar(txs: StoredTransaction[], chaveDe: (t: StoredTransaction) => string): Agrupado[] {
  const mapa = new Map<string, Agrupado>();
  for (const t of txs) {
    if (t.valor <= 0) continue; // ignora pagamentos/estornos
    const chave = chaveDe(t);
    const atual = mapa.get(chave) ?? { chave, total: 0, qtd: 0 };
    atual.total += t.valor;
    atual.qtd += 1;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
}

export function porCategoria(txs: StoredTransaction[]): Agrupado[] {
  return agrupar(txs, (t) => t.categoria ?? "Sem categoria");
}

export function porEstabelecimento(txs: StoredTransaction[]): Agrupado[] {
  return agrupar(txs, (t) => t.estabelecimento ?? t.descricao ?? "—");
}

export function totalGasto(txs: StoredTransaction[]): number {
  return txs.reduce((s, t) => (t.valor > 0 ? s + t.valor : s), 0);
}
