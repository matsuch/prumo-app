import { describe, it, expect } from "vitest";
import {
  fixedTaxa,
  pct,
  pctTrend,
  valueTrend,
  ppTrend,
  addMonthsISO,
  baselineMesAnterior,
  filtrarPeriodo,
} from "../dashboardMetrics";
import type { FixedIncomePosition } from "../fixedIncome";
import type { Snapshot } from "@/lib/supabase/snapshots";

function snap(data: string, patrimonio = 100, investido = 80): Snapshot {
  return { id: data, data, patrimonio, investido, porClasse: null };
}

describe("fixedTaxa", () => {
  const base: FixedIncomePosition = {
    id: "1",
    emissor: "X",
    indexador: "CDI",
    taxa: 110,
    valorAplicado: 1000,
    dataAplicacao: "2024-01-01",
  };
  it("formata IPCA como IPCA+taxa%", () => {
    expect(fixedTaxa({ ...base, indexador: "IPCA", taxa: 6 })).toBe("IPCA+6%");
  });
  it("formata PREFIXADO como taxa% a.a.", () => {
    expect(fixedTaxa({ ...base, indexador: "PREFIXADO", taxa: 12 })).toBe("12% a.a.");
  });
  it("formata pós-fixado como taxa% INDEXADOR", () => {
    expect(fixedTaxa({ ...base, indexador: "CDI", taxa: 110 })).toBe("110% CDI");
  });
});

describe("pct", () => {
  it("usa vírgula decimal e uma casa", () => {
    expect(pct(0.1234)).toBe("12,3%");
    expect(pct(-0.05)).toBe("-5,0%");
  });
});

describe("tendências", () => {
  it("pctTrend é nulo quando a base não é positiva", () => {
    expect(pctTrend(100, 0)).toBeNull();
    expect(pctTrend(100, -10)).toBeNull();
  });
  it("pctTrend calcula alta/baixa com sinal e '−' unicode", () => {
    expect(pctTrend(110, 100)).toEqual({ up: true, badge: "+10,0%" });
    expect(pctTrend(90, 100)).toEqual({ up: false, badge: "−10,0%" });
  });
  it("valueTrend formata a diferença em reais", () => {
    const t = valueTrend(1200, 1000);
    expect(t.up).toBe(true);
    expect(t.badge.startsWith("+")).toBe(true);
    const d = valueTrend(800, 1000);
    expect(d.up).toBe(false);
    expect(d.badge.startsWith("−")).toBe(true);
  });
  it("ppTrend mede pontos percentuais", () => {
    expect(ppTrend(0.12, 0.1)).toEqual({ up: true, badge: "+2,0 pp" });
    expect(ppTrend(0.1, 0.12)).toEqual({ up: false, badge: "−2,0 pp" });
  });
  it("variação zero conta como 'up' (não-negativa)", () => {
    expect(pctTrend(100, 100)?.up).toBe(true);
    expect(ppTrend(0.1, 0.1).up).toBe(true);
  });
});

describe("addMonthsISO", () => {
  it("soma/subtrai meses em UTC sem vazar de fuso", () => {
    expect(addMonthsISO("2026-08-31", -1)).toBe("2026-07-31");
    expect(addMonthsISO("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonthsISO("2026-11-10", 2)).toBe("2027-01-10");
  });
});

describe("baselineMesAnterior", () => {
  const hoje = "2026-08-31";
  it("retorna null sem snapshots anteriores a hoje", () => {
    expect(baselineMesAnterior([], hoje)).toBeNull();
    expect(baselineMesAnterior([snap("2026-08-31")], hoje)).toBeNull(); // não é < hoje
  });
  it("usa o snapshot de ~1 mês atrás e rotula 'vs mês anterior'", () => {
    const snaps = [snap("2026-07-15"), snap("2026-08-20")];
    const r = baselineMesAnterior(snaps, hoje);
    expect(r?.snap.data).toBe("2026-07-15"); // <= hoje−1mês (2026-07-31)
    expect(r?.label).toBe("vs mês anterior");
  });
  it("sem histórico de 1 mês, cai no snapshot mais antigo e rotula 'desde'", () => {
    const snaps = [snap("2026-08-10"), snap("2026-08-20")];
    const r = baselineMesAnterior(snaps, hoje);
    expect(r?.snap.data).toBe("2026-08-10");
    expect(r?.label).toContain("desde");
  });
});

describe("filtrarPeriodo", () => {
  const mk = (offsetDays: number) => ({
    date: new Date(Date.now() - offsetDays * 86_400_000),
  });
  it("'tudo' devolve a série inteira", () => {
    const data = [mk(400), mk(10)];
    expect(filtrarPeriodo(data, "tudo")).toHaveLength(2);
  });
  it("'3m' corta pontos mais antigos que ~3 meses", () => {
    const data = [mk(200), mk(5)];
    const out = filtrarPeriodo(data, "3m");
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(data[1]);
  });
});
