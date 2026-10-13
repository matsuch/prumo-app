"use client";

import * as React from "react";

import { formatMoneyInput, parseMoneyInput } from "@/lib/domain/currency";

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  /** Valor em reais. */
  value: number;
  onChange: (value: number) => void;
};

/**
 * Campo de R$ com máscara estilo caixa: os dígitos entram pela direita e os
 * dois últimos são centavos (13299 → 132,99), sem digitar vírgula. O "R$"
 * fica fora, por conta de quem usa.
 */
function MoneyInput({ value, onChange, ...props }: Props) {
  const text = formatMoneyInput(value);
  const ref = React.useRef<HTMLInputElement>(null);

  // O texto é sempre reescrito; mantém o cursor no fim, onde os dígitos entram.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement === el) el.setSelectionRange(text.length, text.length);
  }, [text]);

  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={(e) => onChange(parseMoneyInput(e.target.value, text))}
      onFocus={(e) => {
        const el = e.currentTarget;
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
        props.onFocus?.(e);
      }}
    />
  );
}

export { MoneyInput };
