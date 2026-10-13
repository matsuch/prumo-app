// Mapa da navegação: o que fica na barra inferior do celular (alcance do polegar),
// o que fica no menu "Mais" e o que o desktop mostra no topo e no menu Admin.
//
// Escolha do padrão: barra inferior + bottom sheet, não menu sanduíche. O app tem
// ~10 destinos, mas 4 concentram o uso diário (dashboard, cadastro — que já inclui
// as metas —, fatura do cartão e ações). Barra inferior deixa esses quatro a UM toque, no canto da
// tela que o polegar alcança, e ainda mostra onde o usuário está — o sanduíche
// custa dois toques, esconde a estrutura e mora no topo (o pior lugar para o
// polegar em tela grande). Os destinos ocasionais não merecem um slot fixo, e é
// aí que o sheet do "Mais" entra.

import type { LucideIcon } from "lucide-react";
import {
  CandlestickChart,
  CreditCard,
  History,
  Home,
  Link2,
  Newspaper,
  Palette,
  Sparkles,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Frase curta no menu "Mais" (a barra inferior mostra só o rótulo). */
  hint?: string;
}

/** Abas fixas da barra inferior (além delas, o botão "Mais"). */
export const TAB_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/cadastro", label: "Cadastro", icon: Wallet },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/acoes", label: "Ações", icon: CandlestickChart },
];

/** Telas de consulta que não cabem na barra inferior — abrem pelo "Mais". */
export const EXPLORE_ITEMS: NavItem[] = [
  {
    href: "/inteligencia",
    label: "Inteligência",
    icon: Newspaper,
    hint: "O que move o mercado",
  },
  { href: "/historico", label: "Histórico", icon: History, hint: "Evolução do patrimônio" },
];

/**
 * Admin: configuração do app, não uso do dia a dia — no desktop fica no menu do
 * canto superior direito (junto da conta); no celular, numa seção própria do "Mais".
 */
export const ADMIN_ITEMS: NavItem[] = [
  { href: "/conectar", label: "Conexões", icon: Link2, hint: "Open Finance via Meu Pluggy" },
  { href: "/memoria", label: "Memória", icon: Sparkles, hint: "O que o Copiloto sabe de você" },
  { href: "/aparencia", label: "Aparência", icon: Palette, hint: "Cores do app" },
];

/** Navegação principal do desktop (barra do topo). */
export const PRIMARY_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/cadastro", label: "Cadastro", icon: Wallet },
  { href: "/cartoes", label: "Cartões", icon: CreditCard },
  { href: "/acoes", label: "Ações", icon: CandlestickChart },
  { href: "/inteligencia", label: "Inteligência", icon: Newspaper },
  { href: "/historico", label: "Histórico", icon: History },
];

/** Rota ativa: "/" casa exato; as demais casam por prefixo (ex.: /acoes?ticker=). */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
