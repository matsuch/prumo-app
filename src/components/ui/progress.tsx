import * as React from "react";

import { cn } from "@/lib/utils";

// Barra de progresso leve (sem Radix) — compatível com o visual do shadcn.
// `indicatorClassName` permite recolorir (ex.: uso do limite acima de 80%).
function Progress({
  className,
  indicatorClassName,
  value = 0,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number;
  indicatorClassName?: string;
}) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("bg-secondary relative h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn("bg-primary h-full rounded-full transition-all", indicatorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
