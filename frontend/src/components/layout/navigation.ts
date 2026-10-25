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
import { hasCapability } from "@/lib/rules";
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
  return hasCapability({ role }, "review_claims")
    ? [DASHBOARD, ITEMS, REGISTER, RETURNS]
    : [ITEMS, REGISTER, MY_CLAIMS];
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
]);

export function isTopLevelPath(pathname: string): boolean {
  return TOP_LEVEL_PATHS.has(pathname);
}

export type RouteChrome =
  | { kind: "top" }
  /** Página de detalhe/formulário: botão voltar + título no header (celular); sem BottomNav. */
  | { kind: "detail"; title: string; backHref: string };

/**
 * Página de origem (`?de=`): o link que abre um detalhe diz de onde veio, e o voltar do header mobile
 * retorna para lá (ex.: Minhas reivindicações → item → voltar). Só caminhos desta lista valem; qualquer
 * outro valor na URL é ignorado, então o parâmetro nunca vira um redirecionamento arbitrário.
 */
export const ORIGIN_PARAM = "de";

const ORIGIN_PATTERNS: readonly RegExp[] = [
  /^\/minhas-reivindicacoes$/,
  /^\/admin\/devolucoes$/,
  /^\/admin\/reivindicacoes\/[\w-]+$/,
  /^\/itens\/(?!novo$)[\w-]+$/,
];

/** O caminho de origem se estiver na lista permitida; senão `null`. */
export function parseOrigin(raw: string | null | undefined): string | null {
  return raw != null && ORIGIN_PATTERNS.some((pattern) => pattern.test(raw)) ? raw : null;
}

/** `href` com a página de origem anexada (`/itens/i1?de=%2Fminhas-reivindicacoes`). */
export function withOrigin(href: string, origin: string): string {
  return `${href}?${ORIGIN_PARAM}=${encodeURIComponent(origin)}`;
}

const DETAIL_ROUTES: {
  pattern: RegExp;
  title: string;
  /**
   * `itemsSearch`: query string da última busca de `/itens` (`""` ou `?categoria=…`).
   * `origin`: página de origem já validada (ou `null`); cada rota só aceita as origens que fazem sentido nela.
   */
  back: (match: RegExpMatchArray, itemsSearch: string, origin: string | null) => string;
}[] = [
  { pattern: /^\/itens\/novo$/, title: "Registrar item", back: (_, itemsSearch) => `/itens${itemsSearch}` },
  { pattern: /^\/itens\/([^/]+)\/reivindicar$/, title: "Reivindicar item", back: (m) => `/itens/${m[1]}` },
  {
    pattern: /^\/itens\/([^/]+)$/,
    title: "Detalhe do item",
    // Do detalhe, o voltar vai à lista de onde se veio; sem origem (ou vindo da busca), reabre a última busca.
    back: (_, itemsSearch, origin) => (origin && !origin.startsWith("/itens/") ? origin : `/itens${itemsSearch}`),
  },
  {
    pattern: /^\/admin\/reivindicacoes\/[^/]+$/,
    title: "Analisar reivindicação",
    // Vindo do item, o voltar retorna ao item; vindo do painel (sem origem), ao painel.
    back: (_, __, origin) => (origin?.startsWith("/itens/") ? origin : "/admin"),
  },
  { pattern: /^\/admin\/itens\/([^/]+)\/editar$/, title: "Editar item", back: (m) => `/itens/${m[1]}` },
  { pattern: /^\/conta$/, title: "Minha conta", back: () => "/itens" },
  { pattern: /^\/privacidade$/, title: "Privacidade", back: () => "/itens" },
];

/**
 * Cromo do header para o caminho. O voltar vai ao "pai" da rota, que não depende do histórico do navegador
 * (poderia sair do app): fixo, ou a `origin` quando o link a informou; a lista de itens reabre com a última
 * busca (`itemsSearch`, ex.: `?categoria=Chaves`). Caminho desconhecido (ex.: 404) usa o cromo de topo.
 */
export function getRouteChrome(pathname: string, itemsSearch = "", origin: string | null = null): RouteChrome {
  const safeOrigin = parseOrigin(origin);
  for (const route of DETAIL_ROUTES) {
    const match = pathname.match(route.pattern);
    if (match) return { kind: "detail", title: route.title, backHref: route.back(match, itemsSearch, safeOrigin) };
  }
  return { kind: "top" };
}

/** Só as páginas de topo mostram o BottomNav (formulários/detalhe usam a barra de ação). */
export function showsBottomNav(pathname: string): boolean {
  return isTopLevelPath(pathname);
}
