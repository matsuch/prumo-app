// MODO DEMO: respostas do Copiloto para as quatro perguntas sugeridas no chat.
// O Copiloto de verdade (Claude com tool-use e memória) fica na versão privada;
// aqui as respostas são montadas com as MESMAS regras de domínio das telas
// (projeção, faturas, composição), a partir da carteira fictícia. Lógica pura.

import { formatBRL } from "@/lib/domain/currency";
import {
  dedupeAccounts,
  faturaAtual,
  porCategoria,
  porEstabelecimento,
  transacoesFaturaAtual,
} from "@/lib/domain/cards";
import type { FixedIncomePosition } from "@/lib/domain/fixedIncome";
import { CLASSES_META, MACRO_DEFAULT, isFII, type ClassId } from "@/lib/domain/marketAssumptions";
import { pluggyCategoriaToClass, pluggyToHoldings } from "@/lib/domain/pluggyMapping";
import { buildProjectionInputs, projectFromPortfolio } from "@/lib/domain/portfolioProjection";
import { passiveIncomeMonthly } from "@/lib/domain/projection";
import type { StockPosition } from "@/lib/domain/stocks";
import type {
  StoredAccount,
  StoredBill,
  StoredPosition,
  StoredTransaction,
} from "@/lib/supabase/pluggy";

export type DemoQuestion = "diversificacao" | "fatura" | "gastos" | "projecao";

/** Reconhece as perguntas sugeridas (e variações próximas). */
export function classifyQuestion(text: string): DemoQuestion | null {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/diversific|composic|alocac/.test(t)) return "diversificacao";
  if (/fatura/.test(t)) return "fatura";
  if (/gast/.test(t)) return "gastos";
  if (/proje|futuro|daqui a/.test(t)) return "projecao";
  return null;
}

export interface DemoCopilotData {
  today: string; // yyyy-mm-dd
  fixed: FixedIncomePosition[];
  stocks: StockPosition[];
  fixedValues: Record<string, number>;
  stockValues: Record<string, number>;
  pluggy: StoredPosition[];
  accounts: StoredAccount[];
  bills: StoredBill[];
  transactions: StoredTransaction[];
  aporteMensal: number;
}

const pct = (v: number, casas = 0) =>
  `${(v * 100).toFixed(casas).replace(".", ",")}%`;

const fmtData = (iso: string | null) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "data a confirmar";

const RODAPE =
  "\n\n_Modo demo: resposta montada com os dados fictícios desta carteira. Conteúdo educacional, não é recomendação de investimento._";

// ---------------------------------------------------------------------------

function diversificacao(d: DemoCopilotData): string {
  const porClasse: Record<ClassId, number> = { renda_fixa: 0, acoes: 0, fii: 0 };
  const itens: { nome: string; valor: number; classe: ClassId }[] = [];

  for (const p of d.fixed) {
    const v = d.fixedValues[p.id] ?? p.valorAplicado;
    porClasse.renda_fixa += v;
    itens.push({ nome: p.emissor, valor: v, classe: "renda_fixa" });
  }
  for (const s of d.stocks) {
    const v = d.stockValues[s.id] ?? s.quantidade * s.precoCompra;
    const classe: ClassId = isFII(s.ticker) ? "fii" : "acoes";
    porClasse[classe] += v;
    itens.push({ nome: s.ticker, valor: v, classe });
  }
  for (const p of d.pluggy) {
    const classe = pluggyCategoriaToClass(p.categoria);
    porClasse[classe] += p.valorAtual;
    itens.push({ nome: p.nome, valor: p.valorAtual, classe });
  }

  const total = Object.values(porClasse).reduce((a, b) => a + b, 0);
  if (total <= 0) return "Ainda não há investimentos cadastrados para eu analisar." + RODAPE;

  const ordem = (Object.keys(porClasse) as ClassId[]).sort((a, b) => porClasse[b] - porClasse[a]);
  const linhasClasse = ordem
    .map((c) => `- **${CLASSES_META[c].label}:** ${formatBRL(porClasse[c])} (${pct(porClasse[c] / total)})`)
    .join("\n");

  const maior = [...itens].sort((a, b) => b.valor - a.valor)[0];
  const acoes = d.stocks.filter((s) => !isFII(s.ticker));
  const fiis = d.stocks.filter((s) => isFII(s.ticker));
  const maiorAcao = acoes
    .map((s) => ({ t: s.ticker, v: d.stockValues[s.id] ?? s.quantidade * s.precoCompra }))
    .sort((a, b) => b.v - a.v)[0];
  const exterior = d.pluggy.filter((p) => /s&p|exterior|global|internacional/i.test(p.nome));
  const vExterior = exterior.reduce((s, p) => s + p.valorAtual, 0);
  const rv = porClasse.acoes + porClasse.fii;

  const pesoRv = rv / total;
  const perfil = pesoRv < 0.15 ? "conservador" : pesoRv <= 0.45 ? "moderado" : "arrojado";
  const pontos: string[] = [];
  pontos.push(
    `**Equilíbrio entre classes:** ${pct(porClasse.renda_fixa / total)} em renda fixa e ${pct(pesoRv)} em renda variável, uma divisão típica de perfil ${perfil}.`,
  );
  if (maiorAcao) {
    const peso = maiorAcao.v / total;
    pontos.push(
      `**Ações:** ${acoes.length} ${acoes.length === 1 ? "empresa" : "empresas"}, e a maior (${maiorAcao.t}) pesa ${pct(peso, 1)} do patrimônio. ` +
        (peso <= 0.1
          ? "Nenhuma ação passa de 10% do total, então o risco de um papel só está controlado."
          : "Uma ação acima de 10% do total concentra bastante risco num papel só."),
    );
  }
  if (fiis.length) {
    pontos.push(
      `**FIIs:** ${fiis.length} ${fiis.length === 1 ? "fundo" : "fundos"} (${fiis.map((f) => f.ticker).join(", ")}). ` +
        (fiis.length >= 3
          ? "Espalhar entre vários fundos dilui o risco de um imóvel ou devedor específico."
          : "Com poucos fundos, a vacância de um imóvel pesa muito na renda."),
    );
  }
  pontos.push(
    vExterior > 0
      ? `**Exterior:** só ${pct(vExterior / total, 1)} fora do Brasil (${exterior.map((e) => e.nome).join(", ")}). É o ponto mais fraco: quase todo o patrimônio depende da economia brasileira.`
      : "**Exterior:** nenhuma exposição fora do Brasil. Todo o patrimônio depende da economia brasileira.",
  );
  pontos.push(
    `**Maior posição:** ${maior.nome}, com ${formatBRL(maior.valor)} (${pct(maior.valor / total)}). ` +
      (maior.classe === "renda_fixa"
        ? "Por ser renda fixa, essa concentração pesa menos no risco."
        : "Por ser renda variável, vale acompanhar de perto."),
  );

  return (
    `Sua carteira soma **${formatBRL(total)}**, assim distribuída:\n\n${linhasClasse}\n\n` +
    `**O que eu observo**\n\n${pontos.map((p) => `- ${p}`).join("\n")}\n\n` +
    `**Se eu fosse ajustar alguma coisa**, direcionaria parte dos próximos aportes para ativos internacionais até chegar perto de 10% do patrimônio, mantendo a reserva de emergência em renda fixa com liquidez diária.` +
    RODAPE
  );
}

function fatura(d: DemoCopilotData): string {
  const cartoes = dedupeAccounts(d.accounts).filter((a) => a.tipo === "CREDIT");
  if (cartoes.length === 0) return "Não encontrei cartões de crédito conectados." + RODAPE;

  let total = 0;
  const linhas: string[] = [];
  const lancamentos: StoredTransaction[] = [];
  for (const c of cartoes) {
    const f = faturaAtual(c, d.bills, d.transactions);
    const lanc = transacoesFaturaAtual(c, d.bills, d.transactions);
    lancamentos.push(...lanc);
    total += f.valor;
    const limite =
      c.limiteTotal != null ? `, ${pct(f.valor / c.limiteTotal)} do limite de ${formatBRL(c.limiteTotal)}` : "";
    linhas.push(
      `- **${c.nome}:** ${formatBRL(f.valor)} até agora (${lanc.length} lançamentos). Fecha em ${fmtData(f.fechamento)} e vence em ${fmtData(f.vencimento)}${limite}.`,
    );
  }

  const cats = porCategoria(lancamentos).slice(0, 3);
  const parcelados = lancamentos.filter((t) => t.totalParcelas && t.totalParcelas > 1);

  let texto =
    `A fatura atual dos seus cartões soma **${formatBRL(total)}**, ainda em aberto:\n\n${linhas.join("\n")}`;
  if (cats.length) {
    texto += `\n\n**Onde está concentrado:** ${cats
      .map((c) => `${c.chave} (${formatBRL(c.total)})`)
      .join(", ")}.`;
  }
  if (parcelados.length) {
    texto += `\n\n**Parcelas:** ${parcelados
      .map((t) => `${t.estabelecimento ?? t.descricao} ${t.parcela}/${t.totalParcelas} (${formatBRL(t.valor)})`)
      .join(", ")}. Elas continuam nas próximas faturas, então já entram no orçamento dos próximos meses.`;
  }
  texto +=
    "\n\nO valor ainda pode subir até o fechamento, porque compras novas entram no ciclo aberto.";
  return texto + RODAPE;
}

function gastos(d: DemoCopilotData): string {
  const cartoes = new Set(
    dedupeAccounts(d.accounts)
      .filter((a) => a.tipo === "CREDIT")
      .map((a) => a.externalId),
  );
  const desde = new Date(`${d.today}T00:00:00Z`);
  desde.setUTCDate(desde.getUTCDate() - 90);
  const corte = desde.toISOString().slice(0, 10);
  const txs = d.transactions.filter(
    (t) => cartoes.has(t.accountId) && t.valor > 0 && t.data != null && t.data >= corte,
  );
  if (txs.length === 0) return "Não encontrei gastos no cartão nos últimos 90 dias." + RODAPE;

  const total = txs.reduce((s, t) => s + t.valor, 0);
  const cats = porCategoria(txs).slice(0, 5);
  const lojas = porEstabelecimento(txs).slice(0, 5);
  const maior = [...txs].sort((a, b) => b.valor - a.valor)[0];

  return (
    `Nos últimos 90 dias você gastou **${formatBRL(total)}** nos cartões (${txs.length} compras), uma média de ${formatBRL(total / 3)} por mês.\n\n` +
    `**Por categoria**\n\n${cats
      .map((c, i) => `${i + 1}. ${c.chave}: ${formatBRL(c.total)} (${pct(c.total / total)})`)
      .join("\n")}\n\n` +
    `**Onde mais gastou**\n\n${lojas
      .map((l) => `- ${l.chave}: ${formatBRL(l.total)} em ${l.qtd} ${l.qtd === 1 ? "compra" : "compras"}`)
      .join("\n")}\n\n` +
    `A maior compra isolada foi ${formatBRL(maior.valor)} em ${maior.estabelecimento ?? maior.descricao} (${fmtData(maior.data)}).\n\n` +
    `**Onde dá para economizar:** ${cats[0].chave} e ${cats[1]?.chave ?? "restaurantes"} somam ${pct(
      (cats[0].total + (cats[1]?.total ?? 0)) / total,
    )} dos gastos. Cortar 15% nessas duas categorias liberaria cerca de ${formatBRL(
      ((cats[0].total + (cats[1]?.total ?? 0)) * 0.15) / 3,
    )} por mês para investir.` +
    RODAPE
  );
}

function projecao(d: DemoCopilotData, anos = 10): string {
  const inputs = buildProjectionInputs(
    d.fixed,
    d.stocks,
    d.fixedValues,
    Object.fromEntries(d.stocks.map((s) => [s.id, d.stockValues[s.id] ?? s.quantidade * s.precoCompra])),
    d.aporteMensal,
    MACRO_DEFAULT,
    pluggyToHoldings(d.pluggy, MACRO_DEFAULT),
  );
  const band = projectFromPortfolio(inputs, anos);
  const fim = (k: keyof typeof band) => band[k][band[k].length - 1]?.total ?? inputs.totalValue;
  const base = fim("base");
  const aportado = inputs.totalValue + d.aporteMensal * anos * 12;

  const classes = inputs.classes
    .map(
      (c) =>
        `- **${c.label}:** ${pct(c.returns.base, 1)} ao ano no cenário base (de ${pct(
          c.returns.pessimista,
          1,
        )} a ${pct(c.returns.otimista, 1)})`,
    )
    .join("\n");

  return (
    `Hoje sua carteira vale **${formatBRL(inputs.totalValue)}**. Mantendo um aporte de **${formatBRL(d.aporteMensal)} por mês** (a sua meta de investimento), ela chega em ${anos} anos a:\n\n` +
    `- **Cenário pessimista:** ${formatBRL(fim("pessimista"))}\n` +
    `- **Cenário base:** ${formatBRL(base)}\n` +
    `- **Cenário otimista:** ${formatBRL(fim("otimista"))}\n\n` +
    `**Como a conta é feita**\n\n` +
    `Cada classe de ativo rende a sua própria taxa, mês a mês, e os aportes são distribuídos na proporção atual da carteira:\n\n${classes}\n\n` +
    `As taxas vêm das premissas de mercado (CDI de ${pct(MACRO_DEFAULT.cdi, 1)} e IPCA de ${pct(MACRO_DEFAULT.ipca, 1)}). Na renda fixa, cada título usa o seu indexador. Os cenários abrem uma faixa de incerteza maior para ações do que para renda fixa.\n\n` +
    `**O que isso significa:** somando o que você já tem e os aportes, você terá colocado ${formatBRL(
      aportado,
    )}. No cenário base, os outros ${formatBRL(base - aportado)} viriam dos rendimentos. Esse patrimônio permitiria retirar cerca de ${formatBRL(
      passiveIncomeMonthly(base),
    )} por mês (regra dos 4% ao ano). Os valores são nominais, sem descontar a inflação.\n\n` +
    `No dashboard, dá para mudar o prazo, o aporte e as premissas para ver a projeção mudar.` +
    RODAPE
  );
}

export function answerDemoQuestion(q: DemoQuestion, d: DemoCopilotData): string {
  switch (q) {
    case "diversificacao":
      return diversificacao(d);
    case "fatura":
      return fatura(d);
    case "gastos":
      return gastos(d);
    case "projecao":
      return projecao(d);
  }
}
