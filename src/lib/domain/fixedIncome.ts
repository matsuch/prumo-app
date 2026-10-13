// Cálculo de rentabilidade REALIZADA de renda fixa, a partir das séries do
// Banco Central (CDI/Selic diários, IPCA mensal).
//
// Convenções de `taxa` conforme o indexador:
//   CDI / SELIC → percentual do índice (ex.: 110 = 110% do CDI)
//   IPCA        → spread real anual em % (ex.: 6 = IPCA + 6%)
//   PREFIXADO   → taxa nominal anual em % (ex.: 12 = 12% a.a.)
//
// Observação: usa dias corridos (ano de 365,25). A convenção de mercado
// brasileira é 252 dias úteis com calendário ANBIMA — refinar depois.

import type { SeriePonto } from "@/lib/market/bacen";
import { businessDaysBetween } from "./businessDays";
import { calcIR } from "./ir";

export type Indexador = "CDI" | "IPCA" | "PREFIXADO" | "SELIC";

export interface FixedIncomePosition {
  id: string;
  emissor: string;
  indexador: Indexador;
  taxa: number;
  valorAplicado: number;
  dataAplicacao: string; // ISO yyyy-mm-dd
  vencimento?: string;
  isento?: boolean; // isento de IR (LCI/LCA, etc.)
}

export interface RentabilidadeResult {
  valorAtual: number; // bruto
  rendimento: number; // bruto
  rentabilidade: number; // total do período (decimal, ex.: 0.23 = 23%)
  rentabilidadeAnual: number; // anualizada base 252 (decimal)
  aliquotaIR: number; // decimal (ex.: 0.15)
  imposto: number; // IR devido em R$
  valorLiquido: number; // valorAtual - imposto
  rendimentoLiquido: number; // rendimento - imposto
}

export interface Series {
  cdi: SeriePonto[];
  selic: SeriePonto[];
  ipca: SeriePonto[];
}

const MS_DIA = 86_400_000;

function parseISO(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function primeiroDiaDoMes(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Fator acumulado de uma série diária (CDI/Selic) com percentual do índice. */
function fatorDiario(serie: SeriePonto[], inicio: Date, fim: Date, percentual: number): number {
  return serie
    .filter((p) => p.data >= inicio && p.data <= fim)
    .reduce((f, p) => f * (1 + (p.valor / 100) * percentual), 1);
}

/** Fator acumulado do IPCA (variação mensal) no período. */
function fatorIpca(serie: SeriePonto[], inicio: Date, fim: Date): number {
  const desde = primeiroDiaDoMes(inicio);
  return serie
    .filter((p) => p.data >= desde && p.data <= fim)
    .reduce((f, p) => f * (1 + p.valor / 100), 1);
}

export function calcFixedIncome(
  pos: FixedIncomePosition,
  hoje: Date,
  series: Series,
): RentabilidadeResult {
  const inicio = parseISO(pos.dataAplicacao);
  const du = businessDaysBetween(inicio, hoje); // dias úteis (base 252)
  const diasCorridos = Math.round((hoje.getTime() - inicio.getTime()) / MS_DIA);
  const expoente = du / 252;
  let fator = 1;

  switch (pos.indexador) {
    case "PREFIXADO":
      fator = Math.pow(1 + pos.taxa / 100, expoente);
      break;
    case "CDI":
      // CDI acumula os fatores diários reais (série do BACEN já é em dias úteis).
      fator = fatorDiario(series.cdi, inicio, hoje, pos.taxa / 100);
      break;
    case "SELIC":
      fator = fatorDiario(series.selic, inicio, hoje, pos.taxa / 100);
      break;
    case "IPCA":
      // IPCA mensal acumulado × spread real em base 252.
      fator = fatorIpca(series.ipca, inicio, hoje) * Math.pow(1 + pos.taxa / 100, expoente);
      break;
  }

  const valorAtual = pos.valorAplicado * fator;
  const rendimento = valorAtual - pos.valorAplicado;
  const rentabilidade = fator - 1;
  const { aliquota, imposto } = calcIR(rendimento, diasCorridos, pos.isento ?? false);

  return {
    valorAtual,
    rendimento,
    rentabilidade,
    rentabilidadeAnual: du > 0 ? Math.pow(fator, 252 / du) - 1 : rentabilidade,
    aliquotaIR: aliquota,
    imposto,
    valorLiquido: valorAtual - imposto,
    rendimentoLiquido: rendimento - imposto,
  };
}

/** Menor data de aplicação entre posições de um dado indexador (para buscar a série). */
export function menorDataAplicacao(
  positions: FixedIncomePosition[],
  indexadores: Indexador[],
): Date | null {
  const datas = positions
    .filter((p) => indexadores.includes(p.indexador))
    .map((p) => parseISO(p.dataAplicacao).getTime());
  return datas.length ? new Date(Math.min(...datas)) : null;
}
