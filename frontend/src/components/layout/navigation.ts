/**
 * Navegação por perfil e "cromo" (header) por rota — funções puras (DESIGN §6.12).
 * Os itens exibidos dependem só do papel; as permissões reais continuam em `lib/rules`.
 */
import {
  LayoutDashboard,
  ListChecks,
  PackageCheck,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/domain";

export interface NavItem {
  href: string;
  /** Rótulo curto (BottomNav). */
  label: string;
  /** Rótulo completo para leitor de tela e para o header desktop. */
  fullLabel: string;
  icon: LucideIcon;
  /** "Registrar": ênfase no BottomNav e botão (não link) no header desktop. */
  isRegister?: boolean;
}

const ITEMS: NavItem = { href: "/itens", label: "Itens", fullLabel: "Itens", icon: Search };
const REGISTER: NavItem = {
  href: "/itens/novo",
  label: "Registrar",
  fullLabel: "Registrar item",
  icon: Plus,
  isRegister: true,
};
const MY_CLAIMS: NavItem = {
  href: "/minhas-reivindicacoes",
  label: "Reivindicações",
  fullLabel: "Minhas reivindicações",
  icon: ListChecks,
};
const DASHBOARD: NavItem = { href: "/admin", label: "Painel", fullLabel: "Painel", icon: LayoutDashboard };
const RETURNS: NavItem = {
  href: "/admin/devolucoes",
  label: "Devoluções",
  fullLabel: "Devoluções",
  icon: PackageCheck,
};

/** Itens do BottomNav (celular). Aluno/professor: 3; administração: 4. */
export function getBottomNavItems(role: UserRole): NavItem[] {
  return role === "admin" ? [DASHBOARD, ITEMS, REGISTER, RETURNS] : [ITEMS, REGISTER, MY_CLAIMS];
}

/** Links de texto do header (≥ 768 px); "Registrar" vira botão à parte. */
export function getHeaderNavItems(role: UserRole): NavItem[] {
  return getBottomNavItems(role).filter((item) => !item.isRegister);
}

/** Item ativo = o de href mais específico que casa com o caminho atual (ou `null`). */
export function getActiveHref(role: UserRole, pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of getBottomNavItems(role)) {
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (best === null || href.length > best.length)) best = href;
  }
  return best;
}

/** Páginas de topo: mostram a marca, o menu da conta e o BottomNav. */
const TOP_LEVEL_PATHS = new Set([
  "/itens",
  "/minhas-reivindicacoes",
  "/admin",
  "/admin/devolucoes",
  // TEMP T04 — página de verificação em "/"; sai na T05 (vira redirecionamento).
  "/",
]);

export function isTopLevelPath(pathname: string): boolean {
  return TOP_LEVEL_PATHS.has(pathname);
}

export type RouteChrome =
  | { kind: "top" }
  /** Página de detalhe/formulário: botão voltar + título no header (celular); sem BottomNav. */
  | { kind: "detail"; title: string; backHref: string };

const DETAIL_ROUTES: { pattern: RegExp; title: string; back: (match: RegExpMatchArray) => string }[] = [
  { pattern: /^\/itens\/novo$/, title: "Registrar item", back: () => "/itens" },
  { pattern: /^\/itens\/([^/]+)\/reivindicar$/, title: "Reivindicar item", back: (m) => `/itens/${m[1]}` },
  { pattern: /^\/itens\/([^/]+)$/, title: "Detalhe do item", back: () => "/itens" },
  { pattern: /^\/admin\/reivindicacoes\/[^/]+$/, title: "Analisar reivindicação", back: () => "/admin" },
  { pattern: /^\/admin\/itens\/([^/]+)\/editar$/, title: "Editar item", back: (m) => `/itens/${m[1]}` },
];

/**
 * Cromo do header para o caminho. O voltar vai ao "pai" fixo da rota (previsível, sem depender do histórico).
 * Caminho desconhecido (ex.: 404) usa o cromo de topo.
 */
export function getRouteChrome(pathname: string): RouteChrome {
  for (const route of DETAIL_ROUTES) {
    const match = pathname.match(route.pattern);
    if (match) return { kind: "detail", title: route.title, backHref: route.back(match) };
  }
  return { kind: "top" };
}

/** Só as páginas de topo mostram o BottomNav (formulários/detalhe usam a barra de ação). */
export function showsBottomNav(pathname: string): boolean {
  return isTopLevelPath(pathname);
}
