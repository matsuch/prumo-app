import React from "react";

// Renderer de markdown leve para as respostas do copiloto. Cobre o subconjunto
// que o modelo costuma emitir: títulos (#), negrito (**), itálico (*/_),
// código inline (`), blocos de código (```), listas (-, *, 1.). Tolerante a
// markdown incompleto (streaming): delimitadores sem fechamento ficam literais.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex =
    /(\[[^\]]+\]\([^)\s]+\))|(`[^`]+`)|(\*\*[\s\S]+?\*\*)|(__[\s\S]+?__)|(\*[^*\n]+?\*)|(_[^_\n]+?_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      if (lm) {
        nodes.push(
          <a
            key={key}
            href={lm[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {lm[1]}
          </a>,
        );
      } else {
        nodes.push(tok);
      }
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={key} className="bg-secondary rounded px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const RE_UL = /^\s*[-*]\s+/;
const RE_OL = /^\s*\d+\.\s+/;
const RE_H = /^(#{1,6})\s+(.*)$/;

type Align = "left" | "center" | "right";

/** Divide uma linha de tabela em células (ignora os pipes das bordas). */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** Linha separadora de tabela GFM (ex.: |---|:--:|---:|). */
function isTableSeparator(line: string): boolean {
  if (!line || !line.includes("-") || !line.includes("|")) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

function alignOf(sepCell: string): Align {
  const l = sepCell.startsWith(":");
  const r = sepCell.endsWith(":");
  if (l && r) return "center";
  if (r) return "right";
  return "left";
}

const ALIGN_CLASS: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export default function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de código cercado
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) code.push(lines[i++]);
      i++; // pula a cerca de fechamento
      blocks.push(
        <pre key={key++} className="bg-secondary overflow-x-auto rounded-lg p-3 font-mono text-xs">
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Tabela GFM: linha com pipes seguida de linha separadora (|---|---|).
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const tKey = key++;
      blocks.push(
        <div key={tKey} className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-xs">
            <thead>
              <tr className="border-b">
                {header.map((c, ci) => (
                  <th
                    key={ci}
                    className={`px-2 py-1.5 font-semibold ${ALIGN_CLASS[aligns[ci] ?? "left"]}`}
                  >
                    {renderInline(c, `th${tKey}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b last:border-0">
                  {header.map((_, ci) => (
                    <td
                      key={ci}
                      className={`px-2 py-1.5 align-top ${ALIGN_CLASS[aligns[ci] ?? "left"]}`}
                    >
                      {renderInline(r[ci] ?? "", `td${tKey}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Título
    const h = RE_H.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <p
          key={key++}
          className={
            level <= 1
              ? "mt-1 text-base font-semibold tracking-tight"
              : level === 2
                ? "mt-1 text-sm font-semibold tracking-tight"
                : "text-muted-foreground text-xs font-semibold uppercase tracking-wide"
          }
        >
          {renderInline(h[2], `h${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    // Lista não ordenada
    if (RE_UL.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && RE_UL.test(lines[i])) {
        items.push(<li key={items.length}>{renderInline(lines[i].replace(RE_UL, ""), `ul${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(
        <ul key={key++} className="marker:text-muted-foreground list-disc space-y-1 pl-5">
          {items}
        </ul>,
      );
      continue;
    }

    // Lista ordenada
    if (RE_OL.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && RE_OL.test(lines[i])) {
        items.push(<li key={items.length}>{renderInline(lines[i].replace(RE_OL, ""), `ol${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(
        <ol key={key++} className="marker:text-muted-foreground list-decimal space-y-1 pl-5">
          {items}
        </ol>,
      );
      continue;
    }

    // Linha em branco
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Parágrafo: junta linhas consecutivas "comuns"
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !RE_UL.test(lines[i]) &&
      !RE_OL.test(lines[i]) &&
      !RE_H.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```")
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++}>
        {para.map((l, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(l, `p${key}-${idx}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  // min-w-0 + overflow-wrap:anywhere garantem que texto longo sem espaços (ex.: URLs
  // cruas de redirecionamento) quebre linha em vez de esticar a coluna do chat.
  return (
    <div className="min-w-0 space-y-3 text-sm leading-relaxed [overflow-wrap:anywhere]">
      {blocks}
    </div>
  );
}
