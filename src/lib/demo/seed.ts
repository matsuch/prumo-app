// Carteira, orçamento e cartões FICTÍCIOS do modo demo. Nada aqui vem de dados
// reais. As datas são relativas a hoje, para o demo nunca parecer abandonado.

export type DemoTables = Record<string, Record<string, unknown>[]>;

/** PRNG determinístico (mulberry32): o demo é igual para todo visitante. */
function prng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (v: number) => Math.round(v * 100) / 100;

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
function monthStart(d: Date, offset = 0) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
}
function dayOfMonth(d: Date, offset: number, day: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, day));
}

const MERCHANTS: { estabelecimento: string; categoria: string; min: number; max: number }[] = [
  { estabelecimento: "Supermercado Bom Preço", categoria: "Supermercado", min: 80, max: 520 },
  { estabelecimento: "Padaria Central", categoria: "Alimentação", min: 12, max: 60 },
  { estabelecimento: "Restaurante Sabor da Casa", categoria: "Restaurantes", min: 45, max: 220 },
  { estabelecimento: "App de Delivery", categoria: "Restaurantes", min: 35, max: 140 },
  { estabelecimento: "Posto Avenida", categoria: "Transporte", min: 120, max: 320 },
  { estabelecimento: "App de Mobilidade", categoria: "Transporte", min: 14, max: 58 },
  { estabelecimento: "Farmácia Saúde", categoria: "Saúde", min: 25, max: 190 },
  { estabelecimento: "Streaming de Vídeo", categoria: "Assinaturas", min: 39.9, max: 39.9 },
  { estabelecimento: "Streaming de Música", categoria: "Assinaturas", min: 21.9, max: 21.9 },
  { estabelecimento: "Academia Movimento", categoria: "Saúde", min: 129, max: 129 },
  { estabelecimento: "Livraria Página", categoria: "Educação", min: 40, max: 160 },
  { estabelecimento: "Pet Shop Amigo", categoria: "Pets", min: 60, max: 240 },
];

export function buildSeed(userId: string, today = new Date()): DemoTables {
  const rand = prng(20261013);
  const now = today.toISOString();
  const base = (extra: Record<string, unknown>) => ({
    user_id: userId,
    created_at: now,
    updated_at: now,
    ...extra,
  });
  let n = 0;
  const id = (p: string) => `${p}-${String(++n).padStart(4, "0")}`;

  // --- Investimentos cadastrados à mão
  const fixed_income = [
    { emissor: "CDB Banco Alfa", indexador: "CDI", taxa: 110, valor_aplicado: 40000, data_aplicacao: iso(addDays(today, -540)), vencimento: iso(addDays(today, 560)), isento: false },
    { emissor: "LCI Banco Beta", indexador: "CDI", taxa: 93, valor_aplicado: 25000, data_aplicacao: iso(addDays(today, -300)), vencimento: iso(addDays(today, 430)), isento: true },
    { emissor: "Tesouro IPCA+ 2035", indexador: "IPCA", taxa: 6.4, valor_aplicado: 30000, data_aplicacao: iso(addDays(today, -720)), vencimento: "2035-05-15", isento: false },
    { emissor: "Tesouro Selic 2029", indexador: "SELIC", taxa: 0.1, valor_aplicado: 18000, data_aplicacao: iso(addDays(today, -200)), vencimento: "2029-03-01", isento: false },
    { emissor: "CDB Prefixado Banco Gama", indexador: "PREFIXADO", taxa: 13.2, valor_aplicado: 12000, data_aplicacao: iso(addDays(today, -150)), vencimento: iso(addDays(today, 580)), isento: false },
  ].map((r) => base({ id: id("rf"), ...r }));

  const stocks = [
    { ticker: "ITUB4", quantidade: 300, preco_compra: 27.4 },
    { ticker: "WEGE3", quantidade: 150, preco_compra: 38.9 },
    { ticker: "PETR4", quantidade: 200, preco_compra: 31.2 },
    { ticker: "BBAS3", quantidade: 250, preco_compra: 24.6 },
    { ticker: "EGIE3", quantidade: 160, preco_compra: 39.4 },
    { ticker: "HGLG11", quantidade: 40, preco_compra: 158 },
    { ticker: "KNCR11", quantidade: 60, preco_compra: 98.5 },
    { ticker: "MXRF11", quantidade: 500, preco_compra: 9.9 },
  ].map((r, i) => base({ id: id("st"), data_compra: iso(addDays(today, -600 + i * 45)), ...r }));

  const watchlist = ["VALE3", "ITUB4", "WEGE3", "PETR4", "B3SA3"].map((ticker) =>
    base({ id: id("wl"), ticker }),
  );

  // --- Metas
  const goals = [
    { nome: "Reserva de emergência", valor_alvo: 60000, data_alvo: iso(addDays(today, 365)), aporte_mensal: 1500 },
    { nome: "Viagem em família", valor_alvo: 25000, data_alvo: iso(addDays(today, 540)), aporte_mensal: 900 },
    { nome: "Independência financeira", valor_alvo: 2500000, data_alvo: iso(addDays(today, 365 * 22)), aporte_mensal: 3000 },
  ].map((r) => base({ id: id("goal"), ...r }));

  // --- Orçamento: entradas, gastos fixos e meta de aporte (últimos 6 meses)
  const monthly_income = [];
  const monthly_goal = [];
  const fixed_expenses = [];
  const gastosFixos: [string, number][] = [
    ["Aluguel", 3200],
    ["Condomínio", 680],
    ["Escola", 1450],
    ["Plano de saúde", 920],
    ["Energia", 290],
    ["Internet e celular", 180],
  ];
  for (let m = -5; m <= 0; m++) {
    const mes = iso(monthStart(today, m));
    const freela = Math.round(1500 + rand() * 2500);
    monthly_income.push(
      base({
        id: id("inc"),
        mes,
        valor: 14000 + freela,
        itens: [
          { descricao: "Salário", valor: 14000 },
          { descricao: "Freelas", valor: freela },
        ],
      }),
    );
    monthly_goal.push(base({ id: id("mg"), mes, valor: 4000 }));
    for (const [nome, valor] of gastosFixos) {
      // Mês corrente: parte já paga; meses anteriores: tudo pago.
      const pago = m < 0 ? valor : rand() < 0.6 ? valor : 0;
      fixed_expenses.push(base({ id: id("fx"), mes, nome, valor, pago }));
    }
  }

  // --- Histórico do patrimônio (um snapshot por mês, 24 meses)
  const snapshots = [];
  let investido = 155000;
  for (let m = -24; m <= -1; m++) {
    investido += 3200 + rand() * 1200;
    const ganho = investido * (0.01 + (m + 24) * 0.003) * (0.85 + rand() * 0.3);
    const patrimonio = investido + ganho;
    snapshots.push(
      base({
        id: id("snap"),
        data: iso(dayOfMonth(today, m + 1, 0)), // último dia do mês
        patrimonio: round2(patrimonio),
        investido: round2(investido),
        por_classe: {
          renda_fixa: round2(patrimonio * 0.52),
          acoes: round2(patrimonio * 0.3),
          fii: round2(patrimonio * 0.18),
        },
      }),
    );
  }

  // --- Open Finance de mentira: uma conexão, conta, dois cartões, previdência
  const itemId = "demo-item-1";
  const pluggy_items = [
    base({
      id: id("pi"),
      item_id: itemId,
      connector_name: "Banco Demo",
      status: "UPDATED",
      execution_status: "SUCCESS",
      last_successful_update_at: now,
      last_synced_at: now,
    }),
  ];

  const pluggy_positions = [
    { external_id: "pos-prev", categoria: "Previdência", nome: "PGBL Renda Fixa Ativo", valor_atual: 48200, valor_investido: 41000 },
    { external_id: "pos-multi", categoria: "Fundos", nome: "Fundo Multimercado Macro", valor_atual: 21800, valor_investido: 20000 },
    { external_id: "pos-etf", categoria: "ETF", nome: "ETF S&P 500", valor_atual: 16400, valor_investido: 12500 },
  ].map((r) => base({ id: id("pp"), item_id: itemId, rendimento: round2(r.valor_atual - r.valor_investido), ...r }));

  const cards = [
    { external_id: "card-platinum", nome: "Cartão Platinum", brand: "MASTERCARD", limite_total: 22000, fecha: 3, vence: 10, escala: 1 },
    { external_id: "card-gold", nome: "Cartão Gold", brand: "VISA", limite_total: 9000, fecha: 18, vence: 25, escala: 0.45 },
  ];

  const pluggy_bills = [];
  const pluggy_transactions = [];
  const usado: Record<string, number> = {};

  for (const c of cards) {
    // Três faturas fechadas + o ciclo aberto atual.
    const fechamentos = [-3, -2, -1, 0].map((m) => dayOfMonth(today, m, c.fecha));
    let ultimoFechamento = fechamentos.filter((d) => d <= today).at(-1)!;
    if (!ultimoFechamento) ultimoFechamento = fechamentos[0];
    const ciclos = fechamentos.filter((d) => d <= ultimoFechamento);

    for (let i = 0; i <= ciclos.length; i++) {
      const inicio = i === 0 ? addDays(ciclos[0], -30) : ciclos[i - 1];
      const fim = i < ciclos.length ? ciclos[i] : today;
      const dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
      const qtd = Math.round(dias * 0.9 * c.escala) + 2;
      let total = 0;
      for (let k = 0; k < qtd; k++) {
        const mer = MERCHANTS[Math.floor(rand() * MERCHANTS.length)];
        const valor = round2(mer.min + rand() * (mer.max - mer.min));
        const data = addDays(inicio, 1 + Math.floor(rand() * dias));
        total += valor;
        pluggy_transactions.push(
          base({
            id: id("tx"),
            item_id: itemId,
            account_id: c.external_id,
            external_id: id("ext"),
            descricao: mer.estabelecimento.toUpperCase(),
            categoria: mer.categoria,
            estabelecimento: mer.estabelecimento,
            valor,
            data: iso(data),
            tipo: "DEBIT",
            parcela: null,
            total_parcelas: null,
          }),
        );
      }
      if (i < ciclos.length) {
        const vencimento = new Date(ciclos[i]);
        vencimento.setUTCDate(c.vence);
        pluggy_bills.push(
          base({
            id: id("bill"),
            item_id: itemId,
            account_id: c.external_id,
            external_id: id("ext"),
            closing_date: iso(ciclos[i]),
            due_date: iso(vencimento),
            total_amount: round2(total),
            minimum_payment: round2(total * 0.15),
          }),
        );
      }
      if (i === ciclos.length) usado[c.external_id] = round2(total);
    }
  }

  // Uma compra parcelada no cartão principal (3ª de 10 no ciclo aberto).
  const parcelaValor = 289.9;
  pluggy_transactions.push(
    base({
      id: id("tx"),
      item_id: itemId,
      account_id: "card-platinum",
      external_id: id("ext"),
      descricao: "LOJA DE ELETRO 3/10",
      categoria: "Compras",
      estabelecimento: "Loja de Eletro",
      valor: parcelaValor,
      data: iso(addDays(today, -2)),
      tipo: "DEBIT",
      parcela: 3,
      total_parcelas: 10,
    }),
  );
  usado["card-platinum"] = round2((usado["card-platinum"] ?? 0) + parcelaValor);

  const pluggy_accounts = [
    base({
      id: id("acc"),
      item_id: itemId,
      external_id: "conta-corrente",
      tipo: "BANK",
      nome: "Conta corrente",
      saldo: 8640.35,
      limite_disponivel: null,
      limite_total: null,
      vencimento: null,
      brand: null,
    }),
    ...cards.map((c) =>
      base({
        id: id("acc"),
        item_id: itemId,
        external_id: c.external_id,
        tipo: "CREDIT",
        nome: c.nome,
        saldo: usado[c.external_id] ?? 0,
        limite_total: c.limite_total,
        limite_disponivel: round2(c.limite_total - (usado[c.external_id] ?? 0)),
        vencimento: iso(dayOfMonth(today, today.getUTCDate() > c.fecha ? 1 : 0, c.vence)),
        brand: c.brand,
      }),
    ),
  ];

  // --- Memória do Copiloto
  const user_memory = [
    { categoria: "perfil", conteudo: "Perfil moderado: aceita oscilação em ações, mas quer a reserva sempre em renda fixa com liquidez diária.", origem: "copiloto" },
    { categoria: "objetivo", conteudo: "Quer chegar a R$ 2,5 milhões para viver de renda em cerca de 22 anos.", origem: "usuario" },
    { categoria: "evento_de_vida", conteudo: "Planeja uma viagem em família no próximo ano e por isso separou uma meta específica.", origem: "copiloto" },
    { categoria: "preferencia", conteudo: "Prefere FIIs de papel e logística a FIIs de shopping.", origem: "usuario" },
  ].map((r) => base({ id: id("mem"), ...r }));

  return {
    fixed_income,
    stocks,
    watchlist,
    goals,
    monthly_goal,
    monthly_income,
    fixed_expenses,
    snapshots,
    pluggy_items,
    pluggy_positions,
    pluggy_accounts,
    pluggy_bills,
    pluggy_transactions,
    user_memory,
  };
}
