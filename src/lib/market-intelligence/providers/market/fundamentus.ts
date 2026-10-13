// Fundamentos (P/L, P/VP, ROE, Dividend Yield) via Fundamentus (fundamentus.com.br).
// Fonte grátis por scraping do HTML — best-effort, com timeout e fallback null.
// O Yahoo quoteSummary hoje exige "crumb" (401), por isso usamos o Fundamentus.

import "server-only";
import type { Fundamentals } from "../../types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const TIMEOUT_MS = 6000;

/** "4,05" → 4.05 · "1.234,56" → 1234.56 · "27,7%" → 27.7 · "-" → null */
function parseNum(s: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\./g, "").replace(",", ".").replace("%", "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Percentual → fração: "7,1%" → 0.071 */
function parsePct(s: string | null): number | null {
  const n = parseNum(s);
  return n == null ? null : n / 100;
}

/** Um indicador exibível (rótulo + valor já formatado em pt-BR pelo Fundamentus). */
export interface Indicator {
  label: string;
  value: string;
}
export interface IndicatorGroup {
  title: string;
  items: Indicator[];
}
/** Conjunto rico de indicadores para o card de detalhe (Bloco 1 + Bloco 2). */
export interface FundamentalsDetail {
  company: string | null;
  sector: string | null;
  subsector: string | null;
  type: string | null;
  marketCap: number | null; // Valor de mercado (número, p/ formatação compacta)
  groups: IndicatorGroup[]; // indicadores detalhados agrupados
}

// Grupos e rótulos exatos do Fundamentus (detalhes.php), decodificados em latin1.
const DETAIL_GROUPS: { title: string; labels: string[] }[] = [
  { title: "Valuation", labels: ["P/L", "P/VP", "P/EBIT", "PSR", "EV / EBITDA", "EV / EBIT", "Div. Yield"] },
  { title: "Rentabilidade", labels: ["ROE", "ROIC", "Marg. Bruta", "Marg. EBIT", "Marg. Líquida", "EBIT / Ativo", "Giro Ativos"] },
  { title: "Endividamento & liquidez", labels: ["Dív Líq / Patrim", "Liquidez Corr", "Cres. Rec (5a)"] },
  { title: "Por ação", labels: ["LPA", "VPA"] },
];

/** Extrai os pares <span class="txt"> da página, decodificando latin1 (acentos). */
async function fetchSpans(ticker: string): Promise<string[] | null> {
  const url = `https://www.fundamentus.com.br/detalhes.php?papel=${encodeURIComponent(ticker)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    // Fundamentus serve em ISO-8859-1; decodifica manualmente p/ preservar acentos.
    const html = new TextDecoder("latin1").decode(await res.arrayBuffer());
    return [...html.matchAll(/<span class="txt">([\s\S]*?)<\/span>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim(),
    );
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Detalhes completos p/ o card do ativo. Best-effort; null se a página falhar. */
export async function getFundamentalsDetail(ticker: string): Promise<FundamentalsDetail | null> {
  const spans = await fetchSpans(ticker);
  if (!spans) return null;
  const valueOf = (label: string): string | null => {
    const i = spans.indexOf(label);
    return i >= 0 && i + 1 < spans.length ? spans[i + 1] : null;
  };

  const groups: IndicatorGroup[] = DETAIL_GROUPS.map((g) => ({
    title: g.title,
    items: g.labels
      .map((label) => ({ label, value: valueOf(label) }))
      .filter((it): it is Indicator => it.value != null && it.value !== "-"),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;

  return {
    company: valueOf("Empresa"),
    sector: valueOf("Setor"),
    subsector: valueOf("Subsetor"),
    type: valueOf("Tipo"),
    marketCap: parseNum(valueOf("Valor de mercado")),
    groups,
  };
}

export async function getFundamentals(ticker: string): Promise<Fundamentals | null> {
  const url = `https://www.fundamentus.com.br/detalhes.php?papel=${encodeURIComponent(ticker)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    if (!res.ok) return null;
    const html = await res.text();

    // A página é uma tabela de pares <span class="txt">Rótulo</span> ... <span class="txt">Valor</span>.
    const spans = [...html.matchAll(/<span class="txt">([\s\S]*?)<\/span>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim(),
    );
    const valueOf = (label: string): string | null => {
      const i = spans.indexOf(label);
      return i >= 0 && i + 1 < spans.length ? spans[i + 1] : null;
    };

    const f: Fundamentals = {
      pl: parseNum(valueOf("P/L")),
      pvp: parseNum(valueOf("P/VP")),
      roe: parsePct(valueOf("ROE")),
      dy: parsePct(valueOf("Div. Yield")),
    };
    if (f.pl == null && f.pvp == null && f.roe == null && f.dy == null) return null;
    return f;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Indicadores usados na nota de carteiras recomendadas (ações e FIIs). */
export interface RecFundamentals {
  pl: number | null;
  pvp: number | null;
  evEbitda: number | null;
  roe: number | null;
  margemLiquida: number | null;
  divLiqPatrim: number | null;
  dy: number | null;
  ffoYield: number | null;
  vacancia: number | null;
  qtdImoveis: number | null;
  capRate: number | null;
  volumeMedio: number | null;
}

/** Pares rótulo → valor da página de detalhes (ação ou FII). Puro, testável. */
export function recFundamentalsFromSpans(spans: string[]): RecFundamentals | null {
  const valueOf = (label: string): string | null => {
    const i = spans.indexOf(label);
    return i >= 0 && i + 1 < spans.length ? spans[i + 1] : null;
  };
  // Percentual só vale se vier com "%": evita ler o rótulo vizinho como valor
  // quando o campo está vazio.
  const pctOf = (label: string) => {
    const v = valueOf(label);
    return v && v.includes("%") ? parsePct(v) : null;
  };
  const f: RecFundamentals = {
    pl: parseNum(valueOf("P/L")),
    pvp: parseNum(valueOf("P/VP")),
    evEbitda: parseNum(valueOf("EV / EBITDA")),
    roe: pctOf("ROE"),
    margemLiquida: pctOf("Marg. Líquida"),
    divLiqPatrim: parseNum(valueOf("Dív Líq / Patrim")),
    dy: pctOf("Div. Yield"),
    ffoYield: pctOf("FFO Yield"),
    vacancia: pctOf("Vacância Média"),
    qtdImoveis: parseNum(valueOf("Qtd imóveis")),
    capRate: pctOf("Cap Rate"),
    volumeMedio: parseNum(valueOf("Vol $ méd (2m)")),
  };
  return Object.values(f).some((v) => v != null) ? f : null;
}

export async function getRecFundamentals(ticker: string): Promise<RecFundamentals | null> {
  const spans = await fetchSpans(ticker);
  return spans ? recFundamentalsFromSpans(spans) : null;
}
