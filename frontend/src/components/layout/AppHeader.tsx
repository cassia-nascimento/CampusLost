"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { AccountMenu } from "./AccountMenu";
import { Brand } from "./Brand";
import { getActiveHref, getHeaderNavItems, type RouteChrome } from "./navigation";

/**
 * Header de 56 px (DESIGN §6.12). Celular: marca (páginas de topo) ou voltar + título (detalhe/formulário).
 * ≥ 768 px: marca, navegação em texto, "Registrar item" e menu da conta.
 */
export function AppHeader({ chrome, pathname }: { chrome: RouteChrome; pathname: string }) {
  const { user, status } = useSession();
  const detail = chrome.kind === "detail";
  const navItems = user ? getHeaderNavItems(user.role) : [];
  const active = user ? getActiveHref(user.role, pathname) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-(--header-h) max-w-admin items-center gap-2 px-gutter">
        {chrome.kind === "detail" ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
            <Link
              href={chrome.backHref}
              aria-label="Voltar"
              className="touch-target -ml-3 inline-flex shrink-0 items-center justify-center rounded-md hover:bg-primary-soft active:bg-primary-softer"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </Link>
            <p className="truncate text-lead font-semibold">{chrome.title}</p>
          </div>
        ) : null}

        <Brand
          href={user ? "/itens" : "/entrar"}
          className={cn(detail ? "hidden md:inline-flex" : "inline-flex")}
        />

        {navItems.length > 0 ? (
          <nav aria-label="Principal" className="ml-4 hidden h-full md:block">
            <ul className="flex h-full">
              {navItems.map((item) => {
                const isActive = item.href === active;
                return (
                  <li key={item.href} className="h-full">
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex h-full items-center px-3 text-body font-semibold hover:text-primary",
                        isActive ? "text-ink" : "text-ink-muted",
                        isActive && "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-primary",
                      )}
                    >
                      {item.fullLabel}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <LinkButton href="/itens/novo" className="hidden md:inline-flex">
                Registrar item
              </LinkButton>
              <AccountMenu />
            </>
          ) : status === "ready" ? (
            <LinkButton href="/entrar" variant="secondary">
              Entrar
            </LinkButton>
          ) : null}
        </div>
      </div>
    </header>
  );
}
