// Normaliza investimentos vindos da API do Pluggy para o formato que guardamos.
// Pluggy já entrega valores MARCADOS A MERCADO (balance/amountProfit), então
// usamos esses números diretamente em vez de recalcular.

export interface PluggyInvestment {
  id?: string;
  code?: string;
  name?: string;
  type?: string; // FIXED_INCOME | EQUITY | MUTUAL_FUND | ETF | SECURITY | COE
  subtype?: string;
  balance?: number; // saldo atual
  value?: number; // preço unitário / valor
  quantity?: number;
  amount?: number;
  amountOriginal?: number; // valor aplicado
  amountProfit?: number; // lucro/prejuízo
  issuer?: string;
}

export interface PluggyPosition {
  externalId: string;
  categoria: string;
  nome: string;
  valorAtual: number;
  valorInvestido: number;
  rendimento: number;
}

const CATEGORIA: Record<string, string> = {
  FIXED_INCOME: "Renda fixa",
  EQUITY: "Ações/FIIs",
  ETF: "ETF",
  MUTUAL_FUND: "Fundos",
  SECURITY: "Previdência",
  COE: "COE",
};

function num(...vals: (number | undefined | null)[]): number {
  for (const v of vals) if (typeof v === "number" && Number.isFinite(v)) return v;
  return 0;
}

export function normalizeInvestment(inv: PluggyInvestment, index: number): PluggyPosition {
  const valorAtual = num(inv.balance, inv.amount, inv.value);
  const rendimento = num(inv.amountProfit);
  const valorInvestido =
    inv.amountOriginal != null ? num(inv.amountOriginal) : valorAtual - rendimento;

  return {
    externalId: inv.id ?? inv.code ?? `${inv.name ?? "pos"}-${index}`,
    categoria: CATEGORIA[inv.type ?? ""] ?? "Outros",
    nome: inv.name ?? inv.issuer ?? "Investimento",
    valorAtual,
    valorInvestido,
    rendimento: inv.amountProfit != null ? rendimento : valorAtual - valorInvestido,
  };
}

export function normalizeInvestments(list: PluggyInvestment[]): PluggyPosition[] {
  return list.map(normalizeInvestment);
}

// ---------------------------------------------------------------------------
// Contas e cartões (endpoint /accounts). type BANK = conta; CREDIT = cartão.
// ---------------------------------------------------------------------------

export interface PluggyRawAccount {
  id?: string;
  type?: string; // BANK | CREDIT
  subtype?: string;
  name?: string;
  marketingName?: string;
  balance?: number; // BANK: saldo; CREDIT: fatura atual (usado)
  currencyCode?: string;
  creditData?: {
    availableCreditLimit?: number | null;
    creditLimit?: number | null;
    balanceDueDate?: string | null;
    brand?: string | null;
  } | null;
  // Saldo que a instituição aplica automaticamente (o "reservado/rendendo" do
  // Mercado Pago, as caixinhas etc.). NÃO está incluído em `balance` — o próprio
  // painel do Pluggy mostra os dois separados —, então quem só lê `balance`
  // simplesmente perde esse dinheiro de vista.
  bankData?: {
    closingBalance?: number | null;
    automaticallyInvestedBalance?: number | null;
  } | null;
}

export interface PluggyAccount {
  externalId: string;
  tipo: "BANK" | "CREDIT";
  nome: string;
  saldo: number; // conta: saldo; cartão: fatura atual
  limiteDisponivel: number | null;
  limiteTotal: number | null;
  vencimento: string | null;
  brand: string | null;
}

export function normalizeAccount(acc: PluggyRawAccount, index: number): PluggyAccount {
  const tipo: "BANK" | "CREDIT" = acc.type === "CREDIT" ? "CREDIT" : "BANK";
  const credit = tipo === "CREDIT";
  return {
    externalId: acc.id ?? `${acc.name ?? "acc"}-${index}`,
    tipo,
    nome: acc.marketingName || acc.name || (credit ? "Cartão" : "Conta"),
    // No Mercado Pago o saldo em conta também rende, então ele vira posição de
    // renda fixa (ver `posicoesDeSaldoRendendo`) e sai do caixa — se ficasse nos
    // dois lugares, a liquidez contaria esse dinheiro duas vezes.
    saldo: !credit && ehMercadoPago(acc) ? 0 : num(acc.balance),
    limiteDisponivel: credit ? (acc.creditData?.availableCreditLimit ?? null) : null,
    limiteTotal: credit ? (acc.creditData?.creditLimit ?? null) : null,
    vencimento: credit ? (acc.creditData?.balanceDueDate ?? null) : null,
    brand: credit ? (acc.creditData?.brand ?? null) : null,
  };
}

export function normalizeAccounts(list: PluggyRawAccount[]): PluggyAccount[] {
  return list.map(normalizeAccount);
}

// ---------------------------------------------------------------------------
// Mercado Pago: todo o dinheiro da conta rende → posições de renda fixa.
//
// No Mercado Pago não existe "saldo parado": tanto o saldo em conta quanto o
// reservado rendem, cada um a uma taxa. Mas o Pluggy não entrega nada disso
// como investimento — o saldo vem em `balance` e o reservado em
// `bankData.automaticallyInvestedBalance`, ambos como dado de conta. O
// reservado, então, ficava órfão: não aparecia nem no caixa nem na carteira.
//
// Aqui os dois viram posições de renda fixa, ao lado dos CDBs, uma por taxa:
//
//   saldo em conta            105% do CDI
//   reservado, até R$ 5.000   120% do CDI
//   reservado, o que passar    100% do CDI
//
// O saldo em conta sai do caixa (ver `normalizeAccount`) para não ser contado
// duas vezes: ele está aqui, não lá.
//
// Escopo de propósito só no Mercado Pago: o Nubank também aplica saldo
// automaticamente, mas já entrega esse dinheiro como posição de CDB/RDB no
// /investments. Gerar posição aqui duplicaria o patrimônio dele.
// ---------------------------------------------------------------------------

/** Teto da faixa premiada do reservado: até aqui rende 120% do CDI. */
export const MERCADO_PAGO_FAIXA_120 = 5000;

function ehMercadoPago(acc: PluggyRawAccount): boolean {
  const nome = `${acc.marketingName ?? ""} ${acc.name ?? ""}`.toLowerCase();
  return nome.includes("mercado pago");
}

export function posicoesDeSaldoRendendo(accounts: PluggyRawAccount[]): PluggyPosition[] {
  const out: PluggyPosition[] = [];

  for (const acc of accounts) {
    if (acc.type === "CREDIT" || !ehMercadoPago(acc)) continue;

    const saldo = num(acc.balance);
    const reservado = num(acc.bankData?.automaticallyInvestedBalance);
    const base = acc.id ?? acc.name ?? "mercadopago";
    const nome = acc.marketingName || acc.name || "Mercado Pago";

    const faixas = [
      { chave: "saldo-105", rotulo: "saldo em conta", taxa: "105% do CDI", valor: saldo },
      {
        chave: "rendendo-120",
        rotulo: "reservado",
        taxa: "120% do CDI",
        valor: Math.min(reservado, MERCADO_PAGO_FAIXA_120),
      },
      {
        chave: "rendendo-100",
        rotulo: "reservado",
        taxa: "100% do CDI",
        valor: Math.max(reservado - MERCADO_PAGO_FAIXA_120, 0),
      },
    ];

    for (const faixa of faixas) {
      if (faixa.valor <= 0) continue;
      out.push({
        externalId: `${base}-${faixa.chave}`,
        categoria: CATEGORIA.FIXED_INCOME,
        nome: `${nome} — ${faixa.rotulo} (${faixa.taxa})`,
        valorAtual: faixa.valor,
        // O Pluggy não informa custo/histórico desse dinheiro: tratamos como
        // aplicado = atual para não inventar rendimento no patrimônio.
        valorInvestido: faixa.valor,
        rendimento: 0,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Faturas de cartão (endpoint /bills). Cada fatura tem vencimento e total.
// ---------------------------------------------------------------------------

export interface PluggyRawBill {
  id?: string;
  dueDate?: string | null;
  billClosingDate?: string | null;
  totalAmount?: number | null;
  minimumPaymentAmount?: number | null;
}

export interface PluggyBill {
  externalId: string;
  accountId: string;
  dueDate: string | null;
  closingDate: string | null;
  totalAmount: number;
  minimumPayment: number | null;
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Pluggy manda datetime ISO; guardamos só YYYY-MM-DD.
  return value.slice(0, 10);
}

export function normalizeBill(bill: PluggyRawBill, accountId: string, index: number): PluggyBill {
  return {
    externalId: bill.id ?? `${accountId}-bill-${index}`,
    accountId,
    dueDate: isoDate(bill.dueDate),
    closingDate: isoDate(bill.billClosingDate),
    totalAmount: num(bill.totalAmount),
    minimumPayment: bill.minimumPaymentAmount != null ? num(bill.minimumPaymentAmount) : null,
  };
}

export function normalizeBills(list: PluggyRawBill[], accountId: string): PluggyBill[] {
  return list.map((bill, i) => normalizeBill(bill, accountId, i));
}

// ---------------------------------------------------------------------------
// Transações de cartão (endpoint /transactions). Em cartão de crédito, amount
// positivo = gasto (aumenta a fatura); negativo = pagamento/estorno.
// ---------------------------------------------------------------------------

export interface PluggyRawTransaction {
  id?: string;
  description?: string | null;
  descriptionRaw?: string | null;
  amount?: number | null;
  date?: string | null;
  category?: string | null;
  type?: string | null; // DEBIT | CREDIT
  merchant?: { name?: string | null; businessName?: string | null } | null;
  // Cartão de crédito: metadados da parcela. Na parcela 1 a `date` é a data real
  // da compra; nas seguintes, é a data de postura na fatura (pode ser futura).
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
  } | null;
}

export interface PluggyTransaction {
  externalId: string;
  accountId: string;
  descricao: string;
  categoria: string | null;
  estabelecimento: string | null;
  valor: number;
  data: string | null;
  tipo: string | null;
  parcela: number | null; // nº da parcela (1 = compra à vista/1ª parcela)
  totalParcelas: number | null;
}

export function normalizeTransaction(
  tx: PluggyRawTransaction,
  accountId: string,
  index: number,
): PluggyTransaction {
  const estab = tx.merchant?.name || tx.merchant?.businessName || null;
  return {
    externalId: tx.id ?? `${accountId}-tx-${index}`,
    accountId,
    descricao: tx.description || tx.descriptionRaw || "Transação",
    categoria: tx.category ?? null,
    estabelecimento: estab,
    valor: num(tx.amount),
    data: isoDate(tx.date),
    tipo: tx.type ?? null,
    parcela: tx.creditCardMetadata?.installmentNumber ?? null,
    totalParcelas: tx.creditCardMetadata?.totalInstallments ?? null,
  };
}

export function normalizeTransactions(
  list: PluggyRawTransaction[],
  accountId: string,
): PluggyTransaction[] {
  return list.map((tx, i) => normalizeTransaction(tx, accountId, i));
}
