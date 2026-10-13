"use client";

import { useMemo, useState } from "react";
import { Group } from "@visx/group";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { ParentSize } from "@visx/responsive";
import { curveMonotoneX } from "@visx/curve";
import { bisector, extent } from "d3-array";
import { formatBRLCents } from "@/lib/domain/currency";

export interface ChartLine {
  ticker: string;
  color: string;
  // value = variação % (unit "%") ou preço em R$ (unit "R$").
  points: { date: Date; value: number }[];
}

type Unit = "%" | "R$";

const MARGIN = { top: 12, right: 16, bottom: 28, left: 58 };
const DRAG_MIN = 5; // px mínimos p/ diferenciar arraste de clique
const bisectDate = bisector<{ date: Date; value: number }, Date>((d) => d.date).left;

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function fmtValue(v: number, unit: Unit): string {
  return unit === "R$" ? formatBRLCents(v) : fmtPct(v);
}
function fmtTick(v: number, unit: Unit): string {
  return unit === "R$" ? formatBRLCents(v) : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;
}
function fmtDay(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Ponto de cada linha mais próximo da data x (para crosshair/seleção). */
function nearest(points: { date: Date; value: number }[], date: Date) {
  const i = bisectDate(points, date, 1);
  const a = points[i - 1];
  const b = points[i];
  if (!b) return a;
  return date.getTime() - a.date.getTime() > b.date.getTime() - date.getTime() ? b : a;
}

/** Variação entre o começo e o fim da seleção (estilo Google). */
function selChange(unit: Unit, v0: number, v1: number): { text: string; up: boolean } {
  if (unit === "R$") {
    const abs = v1 - v0;
    const pct = v0 ? (abs / v0) * 100 : null;
    const pctTxt = pct == null ? "" : ` (${abs >= 0 ? "+" : ""}${pct.toFixed(2).replace(".", ",")}%)`;
    return { text: `${abs >= 0 ? "+" : ""}${formatBRLCents(abs)}${pctTxt}`, up: abs >= 0 };
  }
  // Em "%" os valores são níveis normalizados (base 0% no início da janela);
  // o retorno DENTRO da seleção é o ganho relativo entre os dois níveis.
  const L0 = 1 + v0 / 100;
  const L1 = 1 + v1 / 100;
  const ret = L0 ? (L1 / L0 - 1) * 100 : 0;
  return { text: `${ret >= 0 ? "+" : ""}${ret.toFixed(2).replace(".", ",")}%`, up: ret >= 0 };
}

function Chart({
  lines,
  width,
  height,
  unit,
  selectable,
}: {
  lines: ChartLine[];
  width: number;
  height: number;
  unit: Unit;
  selectable: boolean;
}) {
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const allPoints = lines.flatMap((l) => l.points);
  const [dMin, dMax] = extent(allPoints, (d) => d.date) as [Date, Date];
  const values = allPoints.map((d) => d.value);
  // Em "%" ancora no zero (linha-base da variação); em "R$" usa a extensão dos preços.
  const vMin = unit === "%" ? Math.min(0, ...values) : Math.min(...values);
  const vMax = unit === "%" ? Math.max(0, ...values) : Math.max(...values);
  const pad = Math.max((vMax - vMin) * 0.08, 1);

  const x = scaleTime({ domain: [dMin, dMax], range: [0, innerW] });
  const y = scaleLinear({ domain: [vMin - pad, vMax + pad], range: [innerH, 0], nice: true });

  const clamp = (px: number) => Math.max(0, Math.min(innerW, px));
  const pxFrom = (e: React.MouseEvent) => e.clientX - e.currentTarget.getBoundingClientRect().left - MARGIN.left;

  const selActive = selectable && sel != null && Math.abs(sel.b - sel.a) >= DRAG_MIN;
  const xa = sel ? Math.min(sel.a, sel.b) : 0;
  const xb = sel ? Math.max(sel.a, sel.b) : 0;
  const selLines = selActive
    ? lines.map((l) => ({ ...l, p0: nearest(l.points, x.invert(xa)), p1: nearest(l.points, x.invert(xb)) }))
    : [];

  const hoverDate = hoverX != null ? x.invert(hoverX) : null;
  const hovered =
    hoverDate != null
      ? lines
          .map((l) => ({ ...l, pt: nearest(l.points, hoverDate) }))
          .filter((l) => l.pt)
          .sort((a, b) => b.pt.value - a.pt.value)
      : [];

  return (
    <svg
      width={width}
      height={height}
      className={selectable ? "cursor-crosshair select-none" : undefined}
      onMouseDown={(e) => {
        if (!selectable) return;
        const px = clamp(pxFrom(e));
        setDragging(true);
        setSel({ a: px, b: px });
        setHoverX(null);
      }}
      onMouseMove={(e) => {
        const raw = pxFrom(e);
        if (selectable && dragging) {
          setSel((s) => (s ? { a: s.a, b: clamp(raw) } : { a: clamp(raw), b: clamp(raw) }));
        } else {
          setHoverX(sel ? null : raw >= 0 && raw <= innerW ? raw : null);
        }
      }}
      onMouseUp={() => {
        if (!selectable) return;
        setDragging(false);
        setSel((s) => (s && Math.abs(s.b - s.a) < DRAG_MIN ? null : s)); // clique curto limpa
      }}
      onMouseLeave={() => {
        setHoverX(null);
        if (dragging) setDragging(false);
      }}
    >
      <Group left={MARGIN.left} top={MARGIN.top}>
        <GridRows scale={y} width={innerW} stroke="currentColor" strokeOpacity={0.08} />
        {/* Linha-base do zero (só na visão de variação %) */}
        {unit === "%" && (
          <line x1={0} x2={innerW} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
        )}

        {/* Faixa da seleção por arraste */}
        {selActive && <rect x={xa} y={0} width={xb - xa} height={innerH} fill="var(--primary)" fillOpacity={0.12} />}

        {lines.map((l) => (
          <LinePath
            key={l.ticker}
            data={l.points}
            x={(d) => x(d.date)}
            y={(d) => y(d.value)}
            stroke={l.color}
            strokeWidth={2}
            curve={curveMonotoneX}
          />
        ))}

        {/* Extremos da seleção */}
        {selActive && (
          <>
            <line x1={xa} x2={xa} y1={0} y2={innerH} stroke="currentColor" strokeOpacity={0.3} />
            <line x1={xb} x2={xb} y1={0} y2={innerH} stroke="currentColor" strokeOpacity={0.3} />
            {selLines.map((l) => (
              <g key={l.ticker}>
                <circle cx={x(l.p0.date)} cy={y(l.p0.value)} r={3.5} fill={l.color} stroke="var(--card)" strokeWidth={1.5} />
                <circle cx={x(l.p1.date)} cy={y(l.p1.value)} r={3.5} fill={l.color} stroke="var(--card)" strokeWidth={1.5} />
              </g>
            ))}
          </>
        )}

        {/* Crosshair (só quando não há seleção) */}
        {hoverX != null && !selActive && (
          <>
            <line x1={hoverX} x2={hoverX} y1={0} y2={innerH} stroke="currentColor" strokeOpacity={0.25} />
            {hovered.map((l) => (
              <circle key={l.ticker} cx={x(l.pt.date)} cy={y(l.pt.value)} r={3.5} fill={l.color} stroke="var(--card)" strokeWidth={1.5} />
            ))}
          </>
        )}

        <AxisLeft
          scale={y}
          numTicks={5}
          tickFormat={(v) => fmtTick(Number(v), unit)}
          stroke="currentColor"
          tickStroke="currentColor"
          tickLabelProps={() => ({ fill: "currentColor", fillOpacity: 0.6, fontSize: 11, textAnchor: "end", dx: -4, dy: 4 })}
        />
        <AxisBottom
          scale={x}
          top={innerH}
          numTicks={Math.min(6, allPoints.length)}
          stroke="currentColor"
          tickStroke="currentColor"
          tickLabelProps={() => ({ fill: "currentColor", fillOpacity: 0.6, fontSize: 11, textAnchor: "middle", dy: 4 })}
        />
      </Group>

      {/* Rótulo da seleção (variação do período arrastado) */}
      {selActive && (
        <foreignObject x={Math.max(0, Math.min((xa + xb) / 2 + MARGIN.left - 80, width - 162))} y={0} width={160} height={innerH + MARGIN.top}>
          <div className="bg-card/95 pointer-events-none inline-block rounded-md border px-2 py-1.5 text-[11px] shadow-sm">
            <div className="text-muted-foreground mb-1">
              {fmtDay(x.invert(xa))} – {fmtDay(x.invert(xb))}
            </div>
            {selLines.map((l) => {
              const c = selChange(unit, l.p0.value, l.p1.value);
              return (
                <div key={l.ticker} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1">
                    <span className="inline-block size-2 rounded-full" style={{ background: l.color }} />
                    {l.ticker}
                  </span>
                  <span className={`tabular-nums ${c.up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {c.text}
                  </span>
                </div>
              );
            })}
          </div>
        </foreignObject>
      )}

      {/* Tooltip de hover */}
      {hoverX != null && !selActive && hovered.length > 0 && (
        <foreignObject x={Math.min(hoverX + MARGIN.left + 8, width - 130)} y={MARGIN.top} width={122} height={innerH}>
          <div className="bg-card/95 pointer-events-none rounded-md border px-2 py-1.5 text-[11px] shadow-sm">
            <div className="text-muted-foreground mb-1">{fmtDay(hovered[0].pt.date)}</div>
            {hovered.map((l) => (
              <div key={l.ticker} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  <span className="inline-block size-2 rounded-full" style={{ background: l.color }} />
                  {l.ticker}
                </span>
                <span className="tabular-nums">{fmtValue(l.pt.value, unit)}</span>
              </div>
            ))}
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

export default function AcoesChart({
  lines,
  unit = "%",
  heightClass = "h-72",
  selectable = false,
}: {
  lines: ChartLine[];
  unit?: Unit;
  heightClass?: string;
  selectable?: boolean;
}) {
  const stable = useMemo(() => lines, [lines]);
  return (
    <div className={`text-muted-foreground w-full ${heightClass}`}>
      <ParentSize>
        {({ width, height }) =>
          width > 0 && stable.length > 0 ? (
            <Chart lines={stable} width={width} height={height} unit={unit} selectable={selectable} />
          ) : null
        }
      </ParentSize>
    </div>
  );
}
