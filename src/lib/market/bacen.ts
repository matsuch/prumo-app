// Cliente da API SGS do Banco Central (séries temporais). Público, sem token.
// Docs: https://dadosabertos.bcb.gov.br/  |  formato: dd/mm/yyyy
//
// Séries usadas:
//   12  = CDI diário (% a.d.)
//   11  = Selic diária (% a.d.)
//   433 = IPCA mensal (variação % no mês)

import "server-only";

export const SGS = { CDI: 12, SELIC: 11, IPCA: 433 } as const;

export interface SeriePonto {
  data: Date;
  valor: number;
}

function toBacenDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function parseBacenDate(s: string): Date {
  const [dd, mm, yyyy] = s.split("/").map(Number);
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

/** Busca uma série do SGS entre duas datas (inclusive). Cache de 1h. */
export async function fetchSerie(
  codigo: number,
  inicio: Date,
  fim: Date,
): Promise<SeriePonto[]> {
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json` +
    `&dataInicial=${toBacenDate(inicio)}&dataFinal=${toBacenDate(fim)}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`BACEN série ${codigo} falhou: HTTP ${res.status}`);

  const raw = (await res.json()) as { data: string; valor: string }[];
  return raw.map((r) => ({ data: parseBacenDate(r.data), valor: Number(r.valor) }));
}
