"use client";

import { Group } from "@visx/group";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import { curveMonotoneX } from "@visx/curve";
import { max, extent } from "d3-array";
import { formatBRLCompact, formatCompactAxis } from "@/lib/domain/currency";

export interface HistoryPoint {
  date: Date;
  patrimonio: number;
  investido: number;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 56 };
// No celular a área útil é bem menor: encolhemos as margens (eixo Y mais justo)
// para o gráfico não virar um talo de 200px entre dois eixos.
const MARGIN_MOBILE = { top: 12, right: 10, bottom: 26, left: 40 };

// Rótulo curto de data para o eixo X no celular: "out/25".
function mesAno(d: Date): string {
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(".", "")
    .replace(" de ", "/");
}

function Chart({
  data,
  width,
  height,
  mobile,
}: {
  data: HistoryPoint[];
  width: number;
  height: number;
  mobile: boolean;
}) {
  const margin = mobile ? MARGIN_MOBILE : MARGIN;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const [dMin, dMax] = extent(data, (d) => d.date) as [Date, Date];
  const maxValue = max(data, (d) => Math.max(d.patrimonio, d.investido)) ?? 1;

  const x = scaleTime({ domain: [dMin, dMax], range: [0, innerW] });
  const y = scaleLinear({ domain: [0, maxValue * 1.05], range: [innerH, 0], nice: true });

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        <GridRows scale={y} width={innerW} stroke="currentColor" strokeOpacity={0.08} />

        {/* Investido (cinza) */}
        <LinePath
          data={data}
          x={(d) => x(d.date)}
          y={(d) => y(d.investido)}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          curve={curveMonotoneX}
        />
        {/* Patrimônio */}
        <LinePath
          data={data}
          x={(d) => x(d.date)}
          y={(d) => y(d.patrimonio)}
          stroke="var(--primary)"
          strokeWidth={2.5}
          curve={curveMonotoneX}
        />

        <AxisLeft
          scale={y}
          numTicks={mobile ? 4 : 5}
          tickFormat={(v) => (mobile ? formatCompactAxis(Number(v)) : formatBRLCompact(Number(v)))}
          stroke="currentColor"
          tickStroke="currentColor"
          tickLabelProps={() => ({
            fill: "currentColor",
            fillOpacity: 0.6,
            fontSize: mobile ? 10 : 11,
            textAnchor: "end",
            dx: -4,
            dy: 4,
          })}
        />
        <AxisBottom
          scale={x}
          top={innerH}
          numTicks={Math.min(data.length, mobile ? 4 : 6)}
          tickFormat={mobile ? (v) => mesAno(v as Date) : undefined}
          stroke="currentColor"
          tickStroke="currentColor"
          tickLabelProps={(_v, i, all) => ({
            fill: "currentColor",
            fillOpacity: 0.6,
            fontSize: mobile ? 10 : 11,
            // No celular a primeira/última marca encosta na borda: ancorar pelas
            // pontas evita o rótulo sair do gráfico.
            textAnchor: mobile && i === 0 ? "start" : mobile && i === all.length - 1 ? "end" : "middle",
            dy: 4,
          })}
        />
      </Group>
    </svg>
  );
}

export default function HistoryChart({
  data,
  mobile = false,
}: {
  data: HistoryPoint[];
  mobile?: boolean;
}) {
  return (
    <div className={`w-full text-muted-foreground ${mobile ? "h-56" : "h-64"}`}>
      <ParentSize>
        {({ width, height }) =>
          width > 0 ? <Chart data={data} width={width} height={height} mobile={mobile} /> : null
        }
      </ParentSize>
    </div>
  );
}
