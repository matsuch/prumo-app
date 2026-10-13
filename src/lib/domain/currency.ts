const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const BRL_CENTS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata em R$ sem centavos (bom para valores grandes / projeções). */
export function formatBRL(value: number): string {
  return BRL.format(Math.round(value));
}

/** Formata em R$ com centavos. */
export function formatBRLCents(value: number): string {
  return BRL_CENTS.format(value);
}

/** Formato compacto: R$ 1,2 mi / R$ 340 mil. */
export function formatBRLCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (abs >= 1_000) return `R$ ${Math.round(value / 1_000)} mil`;
  return formatBRL(value);
}

/** Rótulo curtíssimo para eixos em tela pequena: 1,2M / 190k / 850. */
export function formatCompactAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

/* ---- Máscara de digitação estilo caixa: dígitos entram pela direita e os
   dois últimos são centavos (digitar 13299 mostra 132,99). ---- */

const MASK = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Até R$ 99.999.999.999,99 — evita perder precisão em número JS. */
const MAX_MASK_DIGITS = 13;

/** Texto do campo para um valor em reais; zero vira vazio (mostra o placeholder). */
export function formatMoneyInput(value: number): string {
  const cents = Math.round((Number(value) || 0) * 100);
  if (cents <= 0) return "";
  return MASK.format(cents / 100);
}

/**
 * Lê o que a pessoa digitou (com ou sem pontuação) como centavos e devolve
 * o valor em reais. `previous` é o texto mostrado antes da edição: se a
 * pessoa apagou só um separador ("." ou ","), apaga o último dígito.
 */
export function parseMoneyInput(raw: string, previous = ""): number {
  let digits = raw.replace(/\D/g, "");
  const prevDigits = previous.replace(/\D/g, "");
  if (raw.length < previous.length && digits === prevDigits) digits = digits.slice(0, -1);
  digits = digits.replace(/^0+/, "").slice(0, MAX_MASK_DIGITS);
  return digits ? Number(digits) / 100 : 0;
}
