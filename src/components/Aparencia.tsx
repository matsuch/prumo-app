"use client";

import { useEffect, useState } from "react";
import {
  THEME_CONTROLS,
  THEME_PRESETS,
  applyThemeOverrides,
  controlsToVars,
  loadOverrides,
  saveOverrides,
  type ThemeControl,
} from "@/lib/theme";
import { Button } from "./ui/button";
import { useIsMobile } from "@/lib/useIsMobile";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

// Normaliza qualquer cor computada para #rrggbb (o <input type="color"> exige hex).
function toHex(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return (
      "#" +
      v
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  }
  // rgb(a) -> hex
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(",").map((n) => parseInt(n.trim(), 10));
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
    }
  }
  return "#000000";
}

function computedColor(control: ThemeControl): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(control.vars[0]);
  return toHex(raw);
}

export default function Aparencia() {
  const isMobile = useIsMobile();
  const [values, setValues] = useState<Record<string, string>>({});
  const [overridden, setOverridden] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // Semeia o estado com os overrides salvos + as cores atuais do tema.
  useEffect(() => {
    const stored = loadOverrides() ?? {};
    const nextValues: Record<string, string> = {};
    const nextOverridden = new Set<string>();
    for (const control of THEME_CONTROLS) {
      const savedForControl = control.vars.every((v) => stored[v] != null) ? stored[control.vars[0]] : null;
      if (savedForControl) {
        nextValues[control.id] = toHex(savedForControl);
        nextOverridden.add(control.id);
      } else {
        nextValues[control.id] = computedColor(control);
      }
    }
    // Semeadura única no mount a partir de estado client-only (localStorage +
    // getComputedStyle): não dá pra usar inicializador de useState (quebraria no
    // SSR, sem `document`). O aviso de cascata não se aplica aqui.
    /* eslint-disable react-hooks/set-state-in-effect */
    setValues(nextValues);
    setOverridden(nextOverridden);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persiste e aplica sempre que overrides/valores mudam (após pronto).
  function commit(nextValues: Record<string, string>, nextOverridden: Set<string>) {
    setValues(nextValues);
    setOverridden(nextOverridden);
    const activeValues: Record<string, string> = {};
    for (const id of nextOverridden) activeValues[id] = nextValues[id];
    const overrides = controlsToVars(activeValues);
    applyThemeOverrides(Object.keys(overrides).length ? overrides : null);
    saveOverrides(Object.keys(overrides).length ? overrides : null);
  }

  function setControlColor(id: string, color: string) {
    const nextValues = { ...values, [id]: color };
    const nextOverridden = new Set(overridden);
    nextOverridden.add(id);
    commit(nextValues, nextOverridden);
  }

  function resetControl(control: ThemeControl) {
    const nextOverridden = new Set(overridden);
    nextOverridden.delete(control.id);
    // Remove os inline styles deste grupo e relê o valor padrão do tema.
    for (const v of control.vars) document.documentElement.style.removeProperty(v);
    // Reaplica os demais overrides ativos.
    const activeValues: Record<string, string> = {};
    for (const id of nextOverridden) activeValues[id] = values[id];
    applyThemeOverrides(controlsToVars(activeValues));
    const nextValues = { ...values, [control.id]: computedColor(control) };
    commit(nextValues, nextOverridden);
  }

  function applyPreset(presetId: string) {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const nextValues = { ...values };
    const nextOverridden = new Set(overridden);
    for (const [id, color] of Object.entries(preset.values)) {
      nextValues[id] = color;
      nextOverridden.add(id);
    }
    commit(nextValues, nextOverridden);
  }

  function resetAll() {
    applyThemeOverrides(null);
    saveOverrides(null);
    const nextValues: Record<string, string> = {};
    for (const control of THEME_CONTROLS) nextValues[control.id] = computedColor(control);
    setValues(nextValues);
    setOverridden(new Set());
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Temas prontos</CardTitle>
          <CardDescription>
            Um clique aplica um conjunto de cores. Depois você ajusta o que quiser abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                "border-input hover:bg-secondary flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                isMobile && "min-h-12 w-full",
              )}
            >
              <span className="flex -space-x-1.5" aria-hidden="true">
                {Object.values(preset.values)
                  .slice(0, 4)
                  .map((c, i) => (
                    <span
                      key={i}
                      className="border-background size-6 rounded-full border-2"
                      style={{ background: c }}
                    />
                  ))}
              </span>
              <span>
                <span className="block text-sm font-medium">{preset.label}</span>
                <span className="text-muted-foreground block text-xs">{preset.description}</span>
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cores de fundo</CardTitle>
          <CardDescription>
            As mudanças aparecem na hora e ficam salvas neste navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {THEME_CONTROLS.map((control) => {
            const color = values[control.id] ?? "#000000";
            const isOverridden = overridden.has(control.id);
            return (
              <div
                key={control.id}
                className={cn(
                  "flex items-center border-b py-3 last:border-b-0",
                  isMobile ? "flex-wrap gap-3" : "gap-4",
                )}
              >
                <label
                  className="border-input relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border"
                  style={{ background: color }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setControlColor(control.id, e.target.value)}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    aria-label={`Cor: ${control.label}`}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{control.label}</span>
                    {isOverridden && (
                      <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
                        personalizado
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">{control.description}</p>
                </div>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      const next = { ...values, [control.id]: v };
                      setValues(next);
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) setControlColor(control.id, v.toLowerCase());
                    }
                  }}
                  className={cn(
                    "border-input bg-secondary rounded-md border px-2 text-center font-mono uppercase",
                    isMobile ? "h-11 w-28 text-base" : "w-24 py-1 text-xs",
                  )}
                  aria-label={`Código hex: ${control.label}`}
                />
                {isOverridden && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(isMobile && "h-11 px-4")}
                    onClick={() => resetControl(control)}
                  >
                    Padrão
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          A personalização vale só para este navegador/dispositivo.
        </p>
        <Button
          variant="outline"
          className={cn(isMobile && "h-11 w-full")}
          onClick={resetAll}
          disabled={overridden.size === 0}
        >
          Restaurar tudo ao padrão
        </Button>
      </div>
    </div>
  );
}
