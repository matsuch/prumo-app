"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { FixedIncomePosition } from "@/lib/domain/fixedIncome";
import type { StockPosition } from "@/lib/domain/stocks";
import { getCarteira } from "@/lib/supabase/carteira";
import {
  getPluggyAccounts,
  getPluggyBills,
  getPluggyPositions,
  getPluggyTransactions,
  type StoredAccount,
  type StoredBill,
  type StoredPosition,
  type StoredTransaction,
} from "@/lib/supabase/pluggy";
import {
  dedupeAccounts,
  dedupeBills,
  dedupeTransactions,
  faturaAtual,
  faturaDoMes,
  todayISO,
} from "@/lib/domain/cards";
import { formatBRL, formatBRLCents } from "@/lib/domain/currency";
import { MACRO_DEFAULT, CLASSES_META, type Macro, type ClassId } from "@/lib/domain/marketAssumptions";
import { buildProjectionInputs, projectFromPortfolio } from "@/lib/domain/portfolioProjection";
import {
  pluggyToHoldings,
  pluggyTotalInvested,
} from "@/lib/domain/pluggyMapping";
import { passiveIncomeMonthly } from "@/lib/domain/projection";
import { getSnapshots, saveSnapshot, type Snapshot } from "@/lib/supabase/snapshots";
import { syncAllPluggyItems } from "@/lib/pluggy/sync";
import {
  computePortfolioPerformance,
  accumulatedReturnAt,
} from "@/lib/domain/portfolioPerformance";
import { getGoals, type Goal } from "@/lib/supabase/goals";
import { getIncomes, entradaDoMes, mesRef, type MonthlyIncome } from "@/lib/supabase/income";
import {
  getGoals as getMonthlyGoals,
  metaDoMes,
  type MonthlyGoal,
} from "@/lib/supabase/goal";
import { getAllExpenses, expenseSummaryForMonth, type ExpenseRow } from "@/lib/supabase/expenses";
import HistoryChart, { type HistoryPoint } from "./HistoryChart";
import AllocationPieChart from "./AllocationPieChart";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import ProjectionChart from "./ProjectionChart";
import {
  fixedTaxa,
  pct,
  pctTrend,
  valueTrend,
  ppTrend,
  baselineMesAnterior,
  filtrarPeriodo,
  addMonthsISO,
  type Produto,
  type Periodo,
} from "@/lib/domain/dashboardMetrics";
import { Stat, TrendStat, HELP_RENDIMENTO, helpRentabilidade } from "./dashboard/StatCards";
import { BenchmarkCard } from "./dashboard/BenchmarkCard";
import { SuggestionsCard } from "./dashboard/SuggestionsCard";
import { analyzePortfolioHealth, mediaSemOutliers } from "@/lib/domain/portfolioHealth";
import { FluxoMes, type FluxoMesProps } from "./dashboard/FluxoMes";
import { MetasSection } from "./dashboard/MetasSection";
import { CompositionBar } from "./dashboard/CompositionBar";
import { PeriodToggle, MacroControls } from "./dashboard/Controls";
import { useIsMobile } from "@/lib/useIsMobile";
import MobileDashboard from "./mobile/MobileDashboard";

// `email` só é usado pela interface mobile (rodapé com a conta/sair); no desktop
// quem mostra a conta é a TopBar, e o Dashboard segue sendo chamado sem props.
export default function Dashboard({ email = null }: { email?: string | null }) {
  const isMobile = useIsMobile();
  const [fixed, setFixed] = useState<FixedIncomePosition[]>([]);
  const [stocks, setStocks] = useState<StockPosition[]>([]);
  const [pluggy, setPluggy] = useState<StoredPosition[]>([]);
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [bills, setBills] = useState<StoredBill[]>([]);
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [incomes, setIncomes] = useState<MonthlyIncome[]>([]);
  const [monthlyGoals, setMonthlyGoals] = useState<MonthlyGoal[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [fixedValues, setFixedValues] = useState<Record<string, number>>({});
  const [stockValues, setStockValues] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [benchmark, setBenchmark] = useState<{ cdi: number | null; ibov: number | null } | null>(
    null,
  );

  const [years, setYears] = useState(10);
  const [aporte, setAporte] = useState(0);
  const [macro, setMacro] = useState<Macro>(MACRO_DEFAULT);
  // Mês visualizado no "Fluxo do mês" (null = ancorado no mês do ciclo aberto).
  const [mesView, setMesView] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("tudo");

  // Carrega (ou recarrega) todos os dados do dashboard. Reutilizada no mount e pelo
  // botão "Atualizar". Não mexe em `loading` (a tela cheia de "Carregando…" só vale
  // no primeiro carregamento); a recarga manual acontece com o dashboard visível.
  const carregar = useCallback(async () => {
    let c;
    try {
      const [
        carteira,
        pluggyPositions,
        pluggyAccounts,
        pluggyBills,
        pluggyTx,
        snaps,
        gls,
        incs,
        exps,
        mGoals,
      ] = await Promise.all([
        getCarteira(),
        getPluggyPositions().catch(() => [] as StoredPosition[]),
        getPluggyAccounts().catch(() => [] as StoredAccount[]),
        getPluggyBills().catch(() => [] as StoredBill[]),
        getPluggyTransactions().catch(() => [] as StoredTransaction[]),
        getSnapshots().catch(() => [] as Snapshot[]),
        getGoals().catch(() => [] as Goal[]),
        getIncomes().catch(() => [] as MonthlyIncome[]),
        getAllExpenses().catch(() => [] as ExpenseRow[]),
        getMonthlyGoals().catch(() => [] as MonthlyGoal[]),
      ]);
      c = carteira;
      setPluggy(pluggyPositions);
      setAccounts(pluggyAccounts);
      setBills(pluggyBills);
      setTransactions(pluggyTx);
      setSnapshots(snaps);
      setGoals(gls);
      setIncomes(incs);
      setExpenses(exps);
      setMonthlyGoals(mGoals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar carteira");
      setLoading(false);
      return;
    }
    setFixed(c.fixed);
    setStocks(c.stocks);
    if (c.fixed.length === 0 && c.stocks.length === 0) {
      // Sem posições manuais não há o que calcular na /api/carteira; as
      // posições do Pluggy já vêm marcadas a mercado.
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/carteira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixedIncome: c.fixed, stocks: c.stocks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar dados");
      setFixedValues(
        Object.fromEntries(data.fixedResults.map((r: { id: string; valorAtual: number }) => [r.id, r.valorAtual])),
      );
      setStockValues(
        Object.fromEntries(
          data.stockResults.map((r: { id: string; valorAtual: number | null }) => [r.id, r.valorAtual]),
        ),
      );
      setUpdatedAt(data.updatedAt);
      if (data.warnings?.length) setError(data.warnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await carregar();
    })();
  }, [carregar]);

  // "Atualizar": sincroniza as conexões do Meu Pluggy (mesma ação do botão da aba
  // Cartões) e recarrega o dashboard com os dados novos, sem sair da tela.
  const atualizar = useCallback(async () => {
    setSyncing(true);
    setError(null);
    setSyncMsg(null);
    try {
      const r = await syncAllPluggyItems();
      await carregar();
      const extras = [
        r.expired > 0 ? `${r.expired} conexão(ões) expirada(s) — reconecte` : null,
        r.failed.length > 0 ? `${r.failed.length} com falha` : null,
      ].filter(Boolean);
      setSyncMsg(
        `Atualizado: ${r.transactions} transações, ${r.bills} faturas, ${r.accounts} contas/cartões.` +
          (extras.length ? ` (${extras.join(", ")})` : ""),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setSyncing(false);
    }
  }, [carregar]);

  const inputs = useMemo(
    () =>
      buildProjectionInputs(
        fixed,
        stocks,
        fixedValues,
        // valorAtual pode ser null (sem cotação) → cai pro investido
        Object.fromEntries(
          stocks.map((s) => [s.id, stockValues[s.id] ?? s.quantidade * s.precoCompra]),
        ),
        aporte,
        macro,
        pluggyToHoldings(pluggy, macro),
      ),
    [fixed, stocks, fixedValues, stockValues, aporte, macro, pluggy],
  );

  const band = useMemo(() => projectFromPortfolio(inputs, years), [inputs, years]);

  const invested =
    fixed.reduce((s, p) => s + p.valorAplicado, 0) +
    stocks.reduce((s, p) => s + p.quantidade * p.precoCompra, 0) +
    pluggyTotalInvested(pluggy);
  const patrimonio = inputs.totalValue;

  // Performance da carteira via serviço ÚNICO (portfolioPerformance): rendimento
  // em R$ (valor atual − capital líquido) e rentabilidade money-weighted (XIRR).
  // Os fluxos datados de aporte/resgate vêm da variação do "investido" nos
  // snapshots. Sem histórico, a acumulada cai para o retorno simples.
  const investidoSeries = snapshots.map((s) => ({ date: s.data, investido: s.investido }));
  const perf = computePortfolioPerformance({
    series: investidoSeries,
    today: todayISO(),
    patrimonio,
    investido: invested,
  });
  const rendimento = perf.rendimento;
  const rentab = perf.rentabilidadeAcumulada ?? 0; // acumulada (não anualizada)
  const rentabAnual = perf.rentabilidadeAnualizada; // XIRR anualizada (p/ o help)

  // Projeta o patrimônio (cenário base) ao fim de `anos` para um aporte mensal —
  // consolidado (inclui Pluggy) e no macro atual do dashboard. Usado pelas metas.
  function projetarBase(anos: number, ap: number): number {
    const svals = Object.fromEntries(
      stocks.map((s) => [s.id, stockValues[s.id] ?? s.quantidade * s.precoCompra]),
    );
    const inp = buildProjectionInputs(
      fixed,
      stocks,
      fixedValues,
      svals,
      ap,
      macro,
      pluggyToHoldings(pluggy, macro),
    );
    const b = projectFromPortfolio(inp, anos);
    return b.base[b.base.length - 1]?.total ?? patrimonio;
  }

  // Lista unificada de produtos investidos (manual + Pluggy) para exibir na
  // composição do patrimônio. Posições do Pluggy vêm fragmentadas (várias
  // aplicações no mesmo produto, muitas zeradas): consolidamos por produto e
  // escondemos as zeradas.
  const pluggyConsolidado = Object.values(
    pluggy.reduce<Record<string, { nome: string; grupo: string; valor: number; n: number }>>(
      (acc, p) => {
        if (p.valorAtual <= 0) return acc;
        const chave = `${p.categoria}|${p.nome}`;
        (acc[chave] ??= {
          nome: p.nome,
          grupo: p.categoria || "Outros",
          valor: 0,
          n: 0,
        });
        acc[chave].valor += p.valorAtual;
        acc[chave].n += 1;
        return acc;
      },
      {},
    ),
  );

  const produtos: Produto[] = [
    ...fixed
      .map((p) => ({
        id: `f-${p.id}`,
        nome: p.emissor || "Renda fixa",
        detalhe: fixedTaxa(p),
        grupo: "Renda fixa",
        valor: fixedValues[p.id] ?? p.valorAplicado,
      }))
      .filter((p) => p.valor > 0),
    ...stocks
      .map((s) => ({
        id: `s-${s.id}`,
        nome: s.ticker,
        detalhe: `${s.quantidade} cota${s.quantidade === 1 ? "" : "s"}`,
        grupo: "Ações/FIIs",
        valor: stockValues[s.id] ?? s.quantidade * s.precoCompra,
      }))
      .filter((s) => s.valor > 0),
    ...pluggyConsolidado.map((pc) => ({
      id: `p-${pc.grupo}-${pc.nome}`,
      nome: pc.nome,
      detalhe: pc.n > 1 ? `Pluggy · ${pc.n} aplicações` : "Pluggy",
      grupo: pc.grupo,
      valor: pc.valor,
    })),
  ];

  // Snapshot automático: grava (upsert) o patrimônio consolidado de hoje uma vez
  // por sessão, para acumular histórico e permitir a comparação mês a mês.
  const snapSavedRef = useRef(false);
  useEffect(() => {
    if (loading || snapSavedRef.current || patrimonio <= 0) return;
    snapSavedRef.current = true;
    (async () => {
      try {
        await saveSnapshot({
          data: todayISO(),
          patrimonio,
          investido: invested,
          porClasse: inputs.byClassValue,
        });
        setSnapshots(await getSnapshots());
      } catch {
        // silencioso: snapshot é best-effort
      }
    })();
  }, [loading, patrimonio, invested, inputs.byClassValue]);

  // Benchmark (CDI/IBOV): precisa de histórico (>= 2 snapshots) para ter fluxos
  // datados. Busca uma vez quando os dados estão prontos; falha é silenciosa.
  const benchFetchedRef = useRef(false);
  useEffect(() => {
    if (loading || benchFetchedRef.current) return;
    if (snapshots.length < 2 || patrimonio <= 0) return;
    benchFetchedRef.current = true;
    (async () => {
      try {
        const series = snapshots.map((s) => ({ date: s.data, investido: s.investido }));
        const res = await fetch("/api/benchmark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ series, today: todayISO(), patrimonio, investido: invested }),
        });
        if (res.ok) {
          const data = (await res.json()) as { cdi: number | null; ibov: number | null };
          setBenchmark({ cdi: data.cdi ?? null, ibov: data.ibov ?? null });
        }
      } catch {
        // silencioso: benchmark é best-effort
      }
    })();
  }, [loading, snapshots, patrimonio, invested]);

  // Comparação com o mês anterior (a partir dos snapshots já acumulados).
  const baseline = baselineMesAnterior(snapshots, todayISO());
  const trendInvest = baseline
    ? pctTrend(patrimonio, baseline.snap.patrimonio)
    : null;
  // Rendimento em R$ é contribution-neutral por definição (valor − capital), então
  // comparamos direto os R$ de cada data.
  const rendPrev = baseline ? baseline.snap.patrimonio - baseline.snap.investido : 0;
  const trendRend = baseline ? valueTrend(rendimento, rendPrev) : null;
  // Rentabilidade: compara a ACUMULADA de agora com a ACUMULADA de um mês atrás
  // (mesma metodologia money-weighted, mesma base = início), em pontos percentuais.
  const rentabPrev = baseline
    ? accumulatedReturnAt(investidoSeries, {
        date: baseline.snap.data,
        patrimonio: baseline.snap.patrimonio,
        investido: baseline.snap.investido,
      })
    : null;
  const trendRentab = baseline && rentabPrev != null ? ppTrend(rentab, rentabPrev) : null;
  const trendCaption = baseline?.label ?? null;

  // Série para o gráfico de evolução (snapshots já vêm ordenados por data asc).
  const chartData: HistoryPoint[] = snapshots.map((s) => ({
    date: new Date(`${s.data}T00:00:00Z`),
    patrimonio: s.patrimonio,
    investido: s.investido,
  }));
  const chartFiltrado = filtrarPeriodo(chartData, periodo);

  // Dedupe: o mesmo cartão/conta pode vir de mais de um item Pluggy.
  const uniqueAccounts = dedupeAccounts(accounts);
  const uniqueBills = dedupeBills(bills);
  const uniqueTx = dedupeTransactions(transactions);
  // Contas (BANK) = caixa; cartões (CREDIT) = fatura atual (dívida).
  const contas = uniqueAccounts.filter((a) => a.tipo === "BANK");
  const cartoes = uniqueAccounts.filter((a) => a.tipo === "CREDIT");
  const caixa = contas.reduce((s, a) => s + a.saldo, 0);
  // Fatura considerada = a ATUAL (ciclo aberto), somada pelas transações do ciclo,
  // não a já paga nem o balance do Pluggy.
  const faturas = cartoes.reduce((s, a) => s + faturaAtual(a, uniqueBills, uniqueTx).valor, 0);
  const hasAccounts = uniqueAccounts.length > 0;

  // Mês de referência da fatura aberta (menor vencimento entre os cartões).
  const faturaVenc = cartoes
    .map((a) => faturaAtual(a, uniqueBills, uniqueTx).vencimento)
    .filter((v): v is string => !!v)
    .sort()[0];
  const faturaMesLabel = faturaVenc
    ? new Date(`${faturaVenc}T00:00:00Z`).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      })
    : null;

  // Entrada do mês corrente (usada no KPI "Entrada do mês").
  const entradaMes = entradaDoMes(incomes);

  // Fluxo do mês: o período PRINCIPAL acompanha o mês de referência da fatura (o que
  // o usuário está vendo em tela), não o mês do calendário. Em geral é M+1: em agosto,
  // a fatura aberta vence em setembro, então entrada/gastos/fatura são de setembro.
  const mesAtual = mesRef();
  // Âncora = mês de vencimento da fatura aberta. Sem cartão/fatura, fica no mês atual.
  const mesFluxoAnchor = faturaVenc ? mesRef(faturaVenc) : mesAtual;
  // Mês visualizado: o usuário pode navegar (setas); default = âncora.
  const mesFluxo = mesView ?? mesFluxoAnchor;
  const fluxoNoFuturo = mesFluxo > mesAtual;

  // Fatura DO MÊS visualizado: ciclo aberto → estimada; mês passado → fatura fechada
  // real; senão → null (sem fatura). Diferente de `faturas` (KPI/composição = ciclo
  // aberto sempre).
  const faturaMes = faturaDoMes(cartoes, uniqueBills, uniqueTx, mesFluxo);
  const faturaFluxo = faturaMes.valor; // number | null
  const faturaCaption =
    faturaFluxo == null
      ? "sem fatura no mês"
      : faturaMes.fechada
        ? "fatura fechada"
        : faturaMes.estimada
          ? "ciclo aberto"
          : "parcial · parcelas já lançadas";

  const entradaFluxo = entradaDoMes(incomes, mesFluxo);
  // Gastos fixos do período: previsto guia o fluxo planejado; pago/pendente dão o
  // andamento do que já saiu (respeitando o carry-over — mês herdado tem pago 0).
  const resumoFluxo = expenseSummaryForMonth(expenses, mesFluxo);
  const gastosFixosFluxo = resumoFluxo.previsto;
  const sobra = (entradaFluxo ?? 0) - gastosFixosFluxo - (faturaFluxo ?? 0);
  // Meta do mês (o que planeja investir): sem carry-over, vale só no mês definido.
  // Desconta da Sobra → "Livre" é o que resta depois de reservar a meta.
  const metaFluxo = metaDoMes(monthlyGoals, mesFluxo);
  const livre = sobra - metaFluxo;
  const temEntradaFluxo = entradaFluxo != null && entradaFluxo > 0;
  const taxaPoupanca = temEntradaFluxo ? sobra / (entradaFluxo as number) : null;
  const comprometimento = temEntradaFluxo
    ? (gastosFixosFluxo + (faturaFluxo ?? 0)) / (entradaFluxo as number)
    : null;
  // Mostra o card se HÁ dados de fluxo (renda/gastos cadastrados) — independente do
  // mês visualizado, para a navegação não sumir ao cair num mês sem dados.
  const temFluxo = incomes.length > 0 || expenses.length > 0;

  // Limites da navegação: para trás, até o mês mais antigo com algum dado; para
  // frente, alguns meses além da âncora para PLANEJAR (renda/gastos carregam; a
  // fatura aparece "—" enquanto não houver ciclo aberto/fechado naquele mês).
  const fluxoMinMonth = (() => {
    const months = [
      ...incomes.map((i) => i.mes),
      ...expenses.map((e) => e.mes),
      ...uniqueBills.map((b) => (b.dueDate ? `${b.dueDate.slice(0, 7)}-01` : "")),
    ].filter(Boolean);
    const min = months.sort()[0];
    return min && min < mesFluxoAnchor ? min : mesFluxoAnchor;
  })();
  // Até 3 meses à frente do maior entre a âncora e o mês atual.
  const baseFrente = mesFluxoAnchor > mesAtual ? mesFluxoAnchor : mesAtual;
  const fluxoMaxMonth = addMonthsISO(baseFrente, 3);
  const canPrevFluxo = mesFluxo > fluxoMinMonth;
  const canNextFluxo = mesFluxo < fluxoMaxMonth;

  // Pendências do mês atual: quando o fluxo já aponta para o próximo mês, mostramos
  // o que AINDA falta pagar dos gastos fixos do mês corrente (previsto − pago).
  const pendenteMesAtual = fluxoNoFuturo ? expenseSummaryForMonth(expenses, mesAtual).pendente : 0;

  // Rótulo do mês por extenso (ex.: "setembro"), a partir do yyyy-mm-01. Formata em
  // UTC: sem isso, a meia-noite UTC do dia 1º cai no dia anterior no fuso local
  // (Brasil, UTC−3) e o mês exibido volta um (setembro → "agosto").
  const nomeMes = (mes: string) =>
    new Date(`${mes}T00:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });

  const finalBase = band.base[band.base.length - 1]?.total ?? 0;
  const finalPess = band.pessimista[band.pessimista.length - 1]?.total ?? 0;
  const finalOtim = band.otimista[band.otimista.length - 1]?.total ?? 0;
  const income = passiveIncomeMonthly(finalBase);

  // Sugestões de saúde da carteira (reserva, concentração, diversificação).
  // Liquidez p/ reserva = caixa (contas) + renda fixa consolidada (inclui Pluggy).
  // Custo de vida = média dos últimos 12 meses, sem outliers, de: faturas fechadas
  // (os 12 vencimentos antes do ciclo aberto) + gastos fixos (até o mês atual).
  const rendaFixaValor = inputs.byClassValue.renda_fixa ?? 0;
  const ultimos12 = (fim: string) => Array.from({ length: 12 }, (_, k) => addMonthsISO(fim, -k));
  const cartaoMedio = mediaSemOutliers(
    ultimos12(addMonthsISO(mesFluxoAnchor, -1)).map(
      (m) => faturaDoMes(cartoes, uniqueBills, uniqueTx, m).valor ?? 0,
    ),
  ).media;
  const fixoMedio = mediaSemOutliers(
    ultimos12(mesAtual).map((m) => expenseSummaryForMonth(expenses, m).previsto),
  ).media;
  const suggestions = analyzePortfolioHealth({
    patrimonio,
    liquidez: caixa + rendaFixaValor,
    custoFixoMensal: fixoMedio,
    cartaoMensal: cartaoMedio,
    rendaFixaValor,
    acoesFiiValor: (inputs.byClassValue.acoes ?? 0) + (inputs.byClassValue.fii ?? 0),
    holdings: produtos.map((p) => ({ nome: p.nome, valor: p.valor })),
  });

  const isEmpty =
    !loading &&
    fixed.length === 0 &&
    stocks.length === 0 &&
    pluggy.length === 0 &&
    accounts.length === 0;

  // Fatias da alocação por classe (só as com valor) — mesma fonte nas duas interfaces.
  const alocacao = (Object.keys(CLASSES_META) as ClassId[])
    .map((id) => ({
      id,
      label: CLASSES_META[id].label,
      value: inputs.byClassValue[id] ?? 0,
      color: CLASSES_META[id].color,
    }))
    .filter((d) => d.value > 0);

  // Props do "Fluxo do mês" em um objeto só: o card é o mesmo no desktop e no
  // mobile (lá ele só reorganiza o layout), então os números não podem divergir.
  const fluxoProps: FluxoMesProps = {
    entrada: entradaFluxo,
    gastosFixos: gastosFixosFluxo,
    gastosPago: resumoFluxo.pago,
    gastosPendente: resumoFluxo.pendente,
    fatura: faturaFluxo,
    faturaCaption,
    sobra,
    meta: metaFluxo,
    livre,
    taxaPoupanca,
    comprometimento,
    mesLabel: nomeMes(mesFluxo),
    mesAtualLabel: fluxoNoFuturo && pendenteMesAtual > 0 ? nomeMes(mesAtual) : null,
    pendenteMesAtual,
    onPrev: () => setMesView(addMonthsISO(mesFluxo, -1)),
    onNext: () => setMesView(addMonthsISO(mesFluxo, 1)),
    canPrev: canPrevFluxo,
    canNext: canNextFluxo,
    isAnchor: mesFluxo === mesFluxoAnchor,
    onReset: () => setMesView(null),
  };

  // ------------------------------------------------------------------
  // Celular: mesma fonte de dados, interface própria (uma coluna, sem chat).
  // Tudo o que foi calculado acima é entregue pronto para a visão mobile.
  // ------------------------------------------------------------------
  if (isMobile) {
    return (
      <MobileDashboard
        email={email}
        loading={loading}
        empty={isEmpty}
        error={error}
        syncing={syncing}
        syncMsg={syncMsg}
        onAtualizar={() => void atualizar()}
        data={{
          patrimonio,
          rendimento,
          rentab,
          rentabAnual,
          trendInvest,
          trendRend,
          trendRentab,
          trendCaption,
          caixa: contas.length > 0 ? caixa : null,
          faturas: cartoes.length > 0 ? faturas : null,
          faturaMesLabel,
          entradaMes,
          hasAccounts,
          fluxo: temFluxo ? fluxoProps : null,
          suggestions,
          produtos,
          alocacao,
          pluggyCount: pluggy.length,
          goals,
          projetar: projetarBase,
          benchmark:
            perf.rentabilidadeAcumulada != null &&
            benchmark &&
            (benchmark.cdi != null || benchmark.ibov != null)
              ? {
                  rentab: perf.rentabilidadeAcumulada,
                  cdi: benchmark.cdi,
                  ibov: benchmark.ibov,
                  caption: snapshots[0]
                    ? `desde ${new Date(`${snapshots[0].data}T00:00:00Z`).toLocaleDateString("pt-BR")}`
                    : null,
                }
              : null,
          historico:
            chartData.length >= 2
              ? {
                  total: chartData.length,
                  filtrado: chartFiltrado,
                  periodo,
                  onPeriodo: setPeriodo,
                }
              : null,
          projecao: {
            band,
            years,
            onYears: setYears,
            aporte,
            onAporte: setAporte,
            macro,
            onMacro: setMacro,
            finalBase,
            finalPess,
            finalOtim,
            rendaPassiva: income,
            updatedAt,
          },
        }}
      />
    );
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Carregando sua carteira…</p>;
  }

  if (isEmpty) {
    return (
      <Card className="border-dashed py-10 text-center">
        <CardContent className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground text-sm">Você ainda não cadastrou nenhuma posição.</p>
          <Button asChild>
            <Link href="/cadastro?aba=investimentos">Cadastrar minha carteira →</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Ação de atualizar: sincroniza o Meu Pluggy e recarrega os dados. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {syncMsg && <span className="text-positive text-xs">{syncMsg}</span>}
        <Button onClick={atualizar} disabled={syncing} variant="outline" size="sm">
          {syncing ? "Atualizando…" : "↻ Atualizar"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-xs">
          ⚠ {error}
        </p>
      )}

      {/* KPIs */}
      <div className={`grid grid-cols-2 gap-3 ${hasAccounts ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        {hasAccounts ? (
          <>
            {/* Z: Investimentos, Rendimento, Rentabilidade | Fatura, Caixa, Entrada */}
            <TrendStat
              label="Investimentos"
              value={formatBRLCents(patrimonio)}
              trend={trendInvest}
              caption={trendCaption}
            />
            <TrendStat
              label="Rendimento"
              value={formatBRLCents(rendimento)}
              tone={rendimento >= 0 ? "positive" : "negative"}
              trend={trendRend}
              caption={trendCaption}
              help={HELP_RENDIMENTO}
            />
            <TrendStat
              label="Rentabilidade"
              value={pct(rentab)}
              tone={rentab >= 0 ? "positive" : "negative"}
              trend={trendRentab}
              caption={trendCaption}
              help={helpRentabilidade(rentabAnual)}
            />
            {cartoes.length > 0 && (
              <Stat
                label="Fatura do cartão"
                value={`− ${formatBRLCents(faturas)}`}
                tone="negative"
                badge={faturaMesLabel ?? undefined}
              />
            )}
            {contas.length > 0 && <Stat label="Caixa (contas)" value={formatBRLCents(caixa)} />}
            <Stat
              label="Entrada do mês"
              value={entradaMes != null ? formatBRLCents(entradaMes) : "—"}
              tone={entradaMes != null ? "positive" : undefined}
            />
          </>
        ) : (
          <>
            <TrendStat
              label="Investimentos"
              value={formatBRLCents(patrimonio)}
              trend={trendInvest}
              caption={trendCaption}
            />
            <TrendStat
              label="Rendimento"
              value={formatBRLCents(rendimento)}
              tone={rendimento >= 0 ? "positive" : "negative"}
              trend={trendRend}
              caption={trendCaption}
              help={HELP_RENDIMENTO}
            />
            <TrendStat
              label="Rentabilidade"
              value={pct(rentab)}
              tone={rentab >= 0 ? "positive" : "negative"}
              trend={trendRentab}
              caption={trendCaption}
              help={helpRentabilidade(rentabAnual)}
            />
            <Stat
              label="Entrada do mês"
              value={entradaMes != null ? formatBRLCents(entradaMes) : "—"}
              tone={entradaMes != null ? "positive" : undefined}
            />
          </>
        )}
      </div>

      {/* Fluxo do mês */}
      {temFluxo && <FluxoMes {...fluxoProps} />}

      {/* Sugestões de saúde da carteira */}
      <SuggestionsCard suggestions={suggestions} />

      {/* Composição do patrimônio líquido */}
      {hasAccounts && (
        <CompositionBar
          investimentos={patrimonio}
          caixa={caixa}
          faturas={faturas}
          produtos={produtos}
        />
      )}

      {/* Alocação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Alocação por classe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AllocationPieChart
            data={alocacao}
          />
          {pluggy.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <Button asChild variant="link" size="sm" className="text-muted-foreground h-auto px-0">
                <Link href="/conectar">
                  Inclui {pluggy.length} posiç{pluggy.length === 1 ? "ão" : "ões"} do Pluggy →
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metas */}
      {goals.length > 0 && (
        <MetasSection goals={goals} patrimonio={patrimonio} projetar={projetarBase} />
      )}

      {/* Radar da inteligência de mercado sobre os ativos da carteira */}

      {/* Carteira vs. mercado (CDI/IBOV) */}
      {perf.rentabilidadeAcumulada != null &&
        benchmark &&
        (benchmark.cdi != null || benchmark.ibov != null) && (
          <BenchmarkCard
            rentab={perf.rentabilidadeAcumulada}
            cdi={benchmark.cdi}
            ibov={benchmark.ibov}
            caption={
              snapshots[0]
                ? `desde ${new Date(`${snapshots[0].data}T00:00:00Z`).toLocaleDateString("pt-BR")}`
                : null
            }
          />
        )}

      {/* Evolução do patrimônio (snapshots) */}
      {chartData.length >= 2 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-sm">Evolução do patrimônio</CardTitle>
              <PeriodToggle value={periodo} onChange={setPeriodo} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground mb-3 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="bg-primary h-0.5 w-4" /> Patrimônio
              </span>
              <span className="flex items-center gap-1">
                <span className="border-muted-foreground h-0 w-4 border-t border-dashed" /> Investido
              </span>
            </div>
            {chartFiltrado.length >= 2 ? (
              <HistoryChart data={chartFiltrado} />
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Poucos snapshots nesse período. Escolha um intervalo maior.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projeção baseada na carteira */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-sm">Projeção da sua carteira</CardTitle>
              <p className="text-muted-foreground text-xs">
                Parte de {formatBRL(patrimonio)} e projeta com o retorno esperado de cada posição.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <label className="text-xs">
                <span className="text-muted-foreground">Horizonte</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                    className="accent-primary"
                    aria-label="Horizonte em anos"
                  />
                  <span className="w-14 font-medium tabular-nums">{years} anos</span>
                </div>
              </label>
              <label className="text-xs">
                <span className="text-muted-foreground">Aporte/mês</span>
                <div className="border-input bg-transparent mt-0.5 flex items-center rounded-md border px-2">
                  <span className="text-muted-foreground">R$</span>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={aporte}
                    onChange={(e) => setAporte(Math.max(0, Number(e.target.value)))}
                    className="w-20 bg-transparent py-1.5 pl-1 text-sm tabular-nums outline-none"
                    aria-label="Aporte mensal em reais"
                  />
                </div>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={`Patrimônio em ${years}a (base)`} value={formatBRL(finalBase)} />
            <Stat label="Cenário pessimista" value={formatBRL(finalPess)} />
            <Stat label="Cenário otimista" value={formatBRL(finalOtim)} />
            <Stat label="Renda passiva/mês" value={formatBRLCents(income)} />
          </div>

          <ProjectionChart band={band} />

          <MacroControls macro={macro} onChange={setMacro} />

          <p className="text-muted-foreground mt-3 text-xs">
            Valores nominais (antes da inflação). Renda fixa projeta pelo indexador de cada título;
            ações e FIIs pelo retorno esperado da classe. {updatedAt && `Preços de ${new Date(updatedAt).toLocaleDateString("pt-BR")}.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
