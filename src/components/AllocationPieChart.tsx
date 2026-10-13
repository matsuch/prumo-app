"use client";

import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
import { ParentSize } from "@visx/responsive";
import { formatBRL, formatBRLCents } from "@/lib/domain/currency";

export interface AllocationSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

function Chart({
  data,
  width,
  height,
}: {
  data: AllocationSlice[];
  width: number;
  height: number;
}) {
  const size = Math.min(width, height);
  const radius = size / 2;
  const centerY = height / 2;
  const centerX = width / 2;

  return (
    <svg width={width} height={height}>
      <Group top={centerY} left={centerX}>
        <Pie<AllocationSlice>
          data={data}
          pieValue={(d) => d.value}
          outerRadius={radius}
          innerRadius={radius * 0.6}
          padAngle={0.01}
        >
          {(pie) =>
            pie.arcs.map((arc) => (
              <path key={arc.data.id} d={pie.path(arc) ?? undefined} fill={arc.data.color} />
            ))
          }
        </Pie>
      </Group>
    </svg>
  );
}

export default function AllocationPieChart({
  data,
  mobile = false,
}: {
  data: AllocationSlice[];
  /** Modo celular: legenda maior (linha por classe) e valores sem centavos. */
  mobile?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="space-y-3">
      <div className="mx-auto h-56 w-56 max-w-full">
        <ParentSize>
          {({ width, height }) =>
            width > 0 && height > 0 ? <Chart data={data} width={width} height={height} /> : null
          }
        </ParentSize>
      </div>
      <div className={mobile ? "space-y-2.5" : "space-y-2"}>
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div
              key={d.id}
              className={`flex items-center justify-between gap-3 ${mobile ? "text-sm" : "text-xs"}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="truncate">{d.label}</span>
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {mobile ? formatBRL(d.value) : formatBRLCents(d.value)} · {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
