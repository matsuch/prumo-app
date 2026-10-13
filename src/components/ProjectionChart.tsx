"use client";

import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { LinePath, Area } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import { curveMonotoneX } from "@visx/curve";
import { max } from "d3-array";
import type { ScenarioBand } from "@/lib/domain/projection";
import { formatBRLCompact, formatCompactAxis } from "@/lib/domain/currency";

interface Props {
  band: ScenarioBand;
  /** Modo celular: margens e eixos enxutos para caber na tela estreita. */
  mobile?: boolean;
}

const MARGIN = { top: 16, right: 16, bottom: 32, left: 56 };
const MARGIN_MOBILE = { top: 12, right: 10, bottom: 26, left: 40 };

function Chart({
  band,
  width,
  height,
  mobile = false,
}: Props & { width: number; height: number }) {
  const margin = mobile ? MARGIN_MOBILE : MARGIN;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const base = band.base;
  const maxYear = base[base.length - 1]?.year ?? 1;
  const maxValue = max(band.otimista, (d) => d.total) ?? 1;

  const x = scaleLinear({ domain: [0, maxYear], range: [0, innerW] });
  const y = scaleLinear({ domain: [0, maxValue * 1.05], range: [innerH, 0], nice: true });

  // Faixa entre pessimista (baixo) e otimista (cima), indexada por ano.
  const bandData = band.base.map((_, i) => ({
    year: band.base[i].year,
    low: band.pessimista[i]?.total ?? 0,
    high: band.otimista[i]?.total ?? 0,
  }));

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        <GridRows scale={y} width={innerW} stroke="currentColor" strokeOpacity={0.08} />

        {/* Faixa de cenários */}
        <Area
          data={bandData}
          x={(d) => x(d.year)}
          y0={(d) => y(d.low)}
          y1={(d) => y(d.high)}
          fill="var(--primary)"
          fillOpacity={0.12}
          curve={curveMonotoneX}
        />

        {/* Linha do cenário base */}
        <LinePath
          data={base}
          x={(d) => x(d.year)}
          y={(d) => y(d.total)}
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
          numTicks={Math.min(maxYear, mobile ? 5 : 10)}
          tickFormat={(v) => `${v}a`}
          stroke="currentColor"
          tickStroke="currentColor"
          tickLabelProps={(_v, i, all) => ({
            fill: "currentColor",
            fillOpacity: 0.6,
            fontSize: mobile ? 10 : 11,
            textAnchor: mobile && i === 0 ? "start" : mobile && i === all.length - 1 ? "end" : "middle",
            dy: 4,
          })}
        />
      </Group>
    </svg>
  );
}

export default function ProjectionChart({ band, mobile = false }: Props) {
  return (
    <div className={`w-full text-muted ${mobile ? "h-60" : "h-72"}`}>
      <ParentSize>
        {({ width, height }) =>
          width > 0 ? (
            <Chart band={band} width={width} height={height} mobile={mobile} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}
