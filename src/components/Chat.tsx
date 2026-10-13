"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getCarteira } from "@/lib/supabase/carteira";
import {
  getPluggyAccounts,
  getPluggyPositions,
  type StoredAccount,
  type StoredPosition,
} from "@/lib/supabase/pluggy";
import { Send, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import Markdown from "./Markdown";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGESTOES = [
  "Como está minha diversificação?",
  "Quanto está minha fatura atual do cartão?",
  "Quais meus maiores gastos no cartão?",
  "Explique a projeção da minha carteira",
];

export default function Chat({ fill = false }: { fill?: boolean } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCost, setTotalCost] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // O contexto da carteira agora é montado NO SERVIDOR (/api/chat, a partir da
  // sessão). Aqui só fazemos uma checagem leve para decidir o estado "carteira
  // vazia" da UI — sem buscar valuation/fluxo nem enviar contexto ao modelo.
  useEffect(() => {
    (async () => {
      try {
        const [c, positions, accounts] = await Promise.all([
          getCarteira(),
          getPluggyPositions().catch(() => [] as StoredPosition[]),
          getPluggyAccounts().catch(() => [] as StoredAccount[]),
        ]);
        setIsEmpty(
          c.fixed.length === 0 &&
            c.stocks.length === 0 &&
            positions.length === 0 &&
            accounts.length === 0,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar carteira");
      } finally {
        setLoadingCtx(false);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao conversar com a IA");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        // O texto vai até o separador nulo; depois dele vem o JSON de custo.
        const sep = acc.indexOf(String.fromCharCode(0));
        const text = sep >= 0 ? acc.slice(0, sep) : acc;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: text };
          return copy;
        });
      }
      // Trailer com o custo estimado (US$) desta resposta.
      const sep = acc.indexOf(String.fromCharCode(0));
      if (sep >= 0) {
        try {
          const meta = JSON.parse(acc.slice(sep + 1)) as { cost?: number };
          if (typeof meta.cost === "number" && meta.cost > 0) {
            setTotalCost((c) => c + meta.cost!);
          }
        } catch {
          // trailer ausente/incompleto — ignora
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      setMessages((m) => m.slice(0, -1)); // remove o balão vazio do assistente
    } finally {
      setStreaming(false);
    }
  }

  function clear() {
    if (streaming) return;
    setMessages([]);
    setError(null);
    setInput("");
    setTotalCost(0);
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  if (loadingCtx) {
    return <p className="text-muted-foreground text-sm">Preparando o copiloto…</p>;
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-muted-foreground text-sm">
          Cadastre sua carteira para o copiloto poder conversar sobre ela.
        </p>
        <Button asChild className="mt-4">
          <Link href="/cadastro?aba=investimentos">Cadastrar minha carteira →</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`bg-card flex flex-col rounded-xl border ${fill ? "h-full" : "h-[70vh]"}`}>
      {/* Mensagens */}
      <div
        ref={scrollRef}
        aria-live="polite"
        aria-atomic="false"
        className="flex-1 space-y-5 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <p className="text-muted-foreground text-sm text-balance">
              Pergunte sobre sua carteira, rentabilidade, projeção ou a fatura do cartão.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => send(s)}
                  className="h-auto rounded-full py-1.5 text-xs font-normal"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-sm px-4 py-2 text-sm whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="min-w-0 text-sm">
              {m.content ? (
                <Markdown content={m.content} />
              ) : streaming && i === messages.length - 1 ? (
                <TypingDots />
              ) : null}
            </div>
          ),
        )}
      </div>

      {error && <p className="text-destructive px-4 pb-1 text-xs">⚠ {error}</p>}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t p-3"
      >
        <div className="border-input focus-within:border-ring focus-within:ring-ring/50 flex items-end gap-2 rounded-lg border bg-transparent p-1.5 transition-[color,box-shadow] focus-within:ring-[3px]">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            rows={1}
            placeholder="Pergunte sobre sua carteira…"
            aria-label="Sua pergunta ao copiloto"
            autoComplete="off"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none field-sizing-content"
          />
          <Button
            type="submit"
            size="icon"
            disabled={streaming || !input.trim()}
            aria-label="Enviar"
          >
            <Send className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span
            className="text-muted-foreground text-[11px] tabular-nums"
            title="Custo estimado desta conversa (tokens do modelo)"
          >
            {totalCost > 0 ? `US$ ${totalCost.toFixed(4).replace(".", ",")}` : ""}
          </span>
          {messages.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={streaming}
              className="text-muted-foreground h-auto gap-1.5 py-1"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Limpar
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1" aria-label="digitando">
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}
