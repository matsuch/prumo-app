// Dias úteis no padrão do mercado brasileiro (base 252), com o calendário de
// feriados nacionais ANBIMA — incluindo os móveis, derivados da Páscoa.

const MS_DIA = 86_400_000;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_DIA);
}

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano).
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function holidaysForYear(year: number): Set<string> {
  const set = new Set<string>();
  // Feriados nacionais fixos [mês, dia]
  const fixed: [number, number][] = [
    [1, 1], // Confraternização
    [4, 21], // Tiradentes
    [5, 1], // Dia do Trabalho
    [9, 7], // Independência
    [10, 12], // N. Sra. Aparecida
    [11, 2], // Finados
    [11, 15], // Proclamação da República
    [12, 25], // Natal
  ];
  for (const [mo, da] of fixed) set.add(iso(new Date(Date.UTC(year, mo - 1, da))));
  // Consciência Negra — feriado nacional a partir de 2024
  if (year >= 2024) set.add(iso(new Date(Date.UTC(year, 10, 20))));

  const e = easter(year);
  set.add(iso(addDays(e, -48))); // Carnaval (segunda)
  set.add(iso(addDays(e, -47))); // Carnaval (terça)
  set.add(iso(addDays(e, -2))); // Sexta-feira Santa
  set.add(iso(addDays(e, 60))); // Corpus Christi
  return set;
}

const cache = new Map<number, Set<string>>();

function isHoliday(d: Date): boolean {
  const y = d.getUTCFullYear();
  if (!cache.has(y)) cache.set(y, holidaysForYear(y));
  return cache.get(y)!.has(iso(d));
}

/** Conta dias úteis no intervalo [start, end) — dias em que o dinheiro rendeu. */
export function businessDaysBetween(start: Date, end: Date): number {
  const cur = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let count = 0;
  while (cur < stop) {
    const dow = cur.getUTCDay();
    if (dow !== 0 && dow !== 6 && !isHoliday(cur)) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}
