"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMemory,
  getMemories,
  removeMemory,
  updateMemory,
  CATEGORIA_META,
  type MemoriaCategoria,
  type UserMemory,
} from "@/lib/supabase/memory";
import { Button } from "./ui/button";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";

const CATEGORIAS = (Object.keys(CATEGORIA_META) as MemoriaCategoria[]).sort(
  (a, b) => CATEGORIA_META[a].ordem - CATEGORIA_META[b].ordem,
);

export default function Memoria() {
  const isMobile = useIsMobile();
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setMemories(await getMemories());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar a memória");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Agrupa por categoria, respeitando a ordem de exibição.
  const grupos = useMemo(() => {
    return CATEGORIAS.map((cat) => ({
      cat,
      itens: memories.filter((m) => m.categoria === cat),
    })).filter((g) => g.itens.length > 0);
  }, [memories]);

  async function onAdd(categoria: MemoriaCategoria, conteudo: string) {
    try {
      const created = await addMemory(categoria, conteudo, "usuario");
      setMemories((prev) => [created, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }
  async function onRemove(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      await removeMemory(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover");
    }
  }
  async function onEdit(id: string, conteudo: string) {
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, conteudo } : m)));
    try {
      await updateMemory(id, { conteudo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Carregando…</p>;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm text-pretty">
        O que o Copiloto lembra sobre você para personalizar as conversas — seu perfil, objetivos e
        momentos de vida. Ele aprende sozinho, mas você controla tudo aqui: edite ou apague o que
        quiser.
      </p>

      {error && <p className="text-destructive text-xs">⚠ {error}</p>}

      {memories.length === 0 && (
        <div className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          O Copiloto ainda não guardou nada. Conforme você conversa com ele — ou adiciona fatos
          abaixo — sua memória vai se formando.
        </div>
      )}

      <div className="space-y-6">
        {grupos.map(({ cat, itens }) => (
          <div key={cat}>
            <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
              {CATEGORIA_META[cat].label}
            </h3>
            <div className="space-y-2">
              {itens.map((m) => (
                <MemoryRow
                  key={m.id}
                  memory={m}
                  onRemove={() => onRemove(m.id)}
                  onEdit={(c) => onEdit(m.id, c)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <NovaMemoria onAdd={onAdd} mobile={isMobile} />
    </div>
  );
}

function MemoryRow({
  memory,
  onRemove,
  onEdit,
}: {
  memory: UserMemory;
  onRemove: () => void;
  onEdit: (conteudo: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.conteudo);

  function save() {
    const v = draft.trim();
    if (v && v !== memory.conteudo) onEdit(v);
    else setDraft(memory.conteudo);
    setEditing(false);
  }

  return (
    <div className="bg-card flex items-start gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save();
              }
              if (e.key === "Escape") {
                setDraft(memory.conteudo);
                setEditing(false);
              }
            }}
            rows={2}
            autoFocus
            maxLength={500}
            className="focus:border-ring w-full resize-none rounded-md border bg-transparent px-2 py-1 text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="hover:text-primary block w-full cursor-text text-left text-sm"
            title="Clique para editar"
          >
            {memory.conteudo}
          </button>
        )}
        <span
          className="text-muted-foreground mt-1 inline-block text-[11px]"
          title={memory.origem === "usuario" ? "Informado por você" : "Aprendido pelo Copiloto"}
        >
          {memory.origem === "usuario" ? "✎ você" : "🧠 copiloto"}
        </span>
      </div>
      <button
        onClick={onRemove}
        aria-label="Esquecer"
        title="Esquecer"
        className="text-muted-foreground hover:text-destructive relative shrink-0 text-sm after:absolute after:-inset-3 after:content-['']"
      >
        ✕
      </button>
    </div>
  );
}

function NovaMemoria({
  mobile,
  onAdd,
}: {
  onAdd: (categoria: MemoriaCategoria, conteudo: string) => void;
  mobile: boolean;
}) {
  const [categoria, setCategoria] = useState<MemoriaCategoria>("objetivo");
  const [conteudo, setConteudo] = useState("");

  function add() {
    const v = conteudo.trim();
    if (!v) return;
    onAdd(categoria, v);
    setConteudo("");
  }

  return (
    <div className="rounded-xl border border-dashed p-4">
      <h3 className="mb-3 text-sm font-semibold">Adicionar à memória</h3>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-xs sm:w-44">
          <span className="text-muted-foreground">Categoria</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as MemoriaCategoria)}
            className={cn(
              "focus:border-ring mt-0.5 w-full rounded-lg border bg-transparent px-2 outline-none",
              mobile ? "h-11 text-base" : "py-1.5 text-sm",
            )}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_META[c].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-xs">
          <span className="text-muted-foreground">Fato</span>
          <input
            type="text"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ex.: Quero comprar um imóvel até 2028."
            maxLength={500}
            className={cn(
              "focus:border-ring mt-0.5 w-full rounded-lg border bg-transparent px-2 outline-none",
              mobile ? "h-11 text-base" : "py-1.5 text-sm",
            )}
          />
        </label>
        <Button
          onClick={add}
          disabled={!conteudo.trim()}
          className={cn(mobile && "h-11 w-full")}
        >
          Adicionar
        </Button>
      </div>
    </div>
  );
}
