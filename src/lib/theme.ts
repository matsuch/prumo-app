// Personalização de aparência (página /aparencia).
//
// Permite ao usuário sobrescrever as variáveis CSS de fundo/superfície do tema.
// Os overrides são salvos no navegador (localStorage) e aplicados como estilo
// inline no <html>, que vence as regras de :root e do @media (prefers-color-scheme).
// Assim o app deixa de ser "muito escuro" sem depender do tema do sistema.

export const THEME_STORAGE_KEY = "prumo-theme-overrides";

// Cada controle da página mapeia para uma ou mais variáveis CSS. O usuário
// escolhe uma cor e ela é aplicada a todas as variáveis do grupo de uma vez.
export type ThemeControl = {
  id: string;
  label: string;
  description: string;
  vars: string[];
};

export const THEME_CONTROLS: ThemeControl[] = [
  {
    id: "background",
    label: "Fundo da página",
    description: "A tela por trás de tudo (canvas).",
    vars: ["--background"],
  },
  {
    id: "card",
    label: "Cartões",
    description: "Fundo dos cards, painéis e menus.",
    vars: ["--surface", "--card", "--popover"],
  },
  {
    id: "surface2",
    label: "Superfícies secundárias",
    description: "Inputs, linhas alternadas e botões suaves.",
    vars: ["--surface-2", "--secondary"],
  },
  {
    id: "border",
    label: "Bordas",
    description: "Contornos de cards, inputs e divisórias.",
    vars: ["--border", "--input"],
  },
  {
    id: "foreground",
    label: "Texto principal",
    description: "Cor do texto sobre os fundos acima.",
    vars: ["--foreground", "--card-foreground", "--popover-foreground", "--secondary-foreground"],
  },
];

export type ThemeOverrides = Record<string, string>;

// Presets prontos: cada um é um mapa de controle.id -> cor.
export type ThemePreset = {
  id: string;
  label: string;
  description: string;
  values: Record<string, string>;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "claro",
    label: "Claro",
    description: "Fundo branco/cinza claro, texto escuro.",
    values: {
      background: "#f7f7f8",
      card: "#ffffff",
      surface2: "#f1f1f3",
      border: "#e6e6e9",
      foreground: "#0a0a0a",
    },
  },
  {
    id: "cinza-suave",
    label: "Cinza suave",
    description: "Escuro, porém mais claro que o padrão.",
    values: {
      background: "#1e2024",
      card: "#282b30",
      surface2: "#33373d",
      border: "#3f444b",
      foreground: "#eef0f2",
    },
  },
  {
    id: "azul-noite",
    label: "Azul noite",
    description: "Fundo azul-acinzentado, menos preto.",
    values: {
      background: "#182029",
      card: "#212c38",
      surface2: "#2b3846",
      border: "#374656",
      foreground: "#eaf1f8",
    },
  },
];

// Converte um mapa controle.id -> cor em um mapa variável CSS -> cor.
export function controlsToVars(values: Record<string, string>): ThemeOverrides {
  const out: ThemeOverrides = {};
  for (const control of THEME_CONTROLS) {
    const color = values[control.id];
    if (!color) continue;
    for (const cssVar of control.vars) out[cssVar] = color;
  }
  return out;
}

// Aplica (ou limpa) os overrides no elemento <html>. Estilo inline vence
// qualquer regra de folha de estilo, inclusive o @media do modo escuro.
export function applyThemeOverrides(overrides: ThemeOverrides | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const managed = new Set<string>();
  for (const control of THEME_CONTROLS) for (const v of control.vars) managed.add(v);

  for (const cssVar of managed) root.style.removeProperty(cssVar);
  if (overrides) {
    for (const [cssVar, color] of Object.entries(overrides)) {
      root.style.setProperty(cssVar, color);
    }
  }
}

export function loadOverrides(): ThemeOverrides | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ThemeOverrides) : null;
  } catch {
    return null;
  }
}

export function saveOverrides(overrides: ThemeOverrides | null): void {
  if (typeof window === "undefined") return;
  try {
    if (overrides && Object.keys(overrides).length > 0) {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(overrides));
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

// Script (stringificado) injetado no <head> para aplicar os overrides antes da
// primeira pintura, evitando "flash" do tema padrão antes da hidratação.
export const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem('${THEME_STORAGE_KEY}');if(!raw)return;var o=JSON.parse(raw);if(!o||typeof o!=='object')return;var s=document.documentElement.style;for(var k in o){if(k.indexOf('--')===0)s.setProperty(k,o[k]);}}catch(e){}})();`;
