"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { withNext } from "@/components/auth/next-param";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Brand } from "./Brand";
import { NavLink } from "./NavLink";
import type { RouteChrome } from "./navigation";

const ITEMS_HREF = "/itens";

/**
 * Header do visitante (DESIGN §6.12, P26): `/`, `/itens` e `/itens/[id]` sem sessão. Nunca tem BottomNav.
 * 360 px: marca + "Entrar" (cabe com alvo de 44 px; "Criar conta" fica no corpo das telas). A partir de 640 px
 * entram "Ver itens" e "Criar conta"; a partir de 768 px "Ver itens" sobe para a navegação ao lado da marca.
 * No detalhe do item, no celular, vira o header de drill-down (voltar + título), como o do usuário logado.
 * Em `/itens/[id]`, "Entrar" e "Criar conta" levam o item no `?next=` para a pessoa voltar a ele.
 */
export function PublicHeader({ chrome = { kind: "top" }, pathname }: { chrome?: RouteChrome; pathname: string }) {
  const detail = chrome.kind === "detail";
  const onItems = pathname === ITEMS_HREF;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-(--header-h) max-w-page items-center gap-2 px-gutter">
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

        <Brand href="/" className={cn(detail ? "hidden md:inline-flex" : "inline-flex")} />

        <nav aria-label="Principal" className="ml-4 hidden h-full md:block">
          <NavLink href={ITEMS_HREF} active={onItems}>
            Ver itens
          </NavLink>
        </nav>

        <div className={cn("ml-auto items-center gap-2", detail ? "hidden sm:flex" : "flex")}>
          <Link
            href={ITEMS_HREF}
            className="touch-target hidden items-center rounded-md px-3 text-body font-semibold text-primary hover:bg-primary-soft sm:inline-flex md:hidden"
          >
            Ver itens
          </Link>
          <LinkButton
            href={withNext("/entrar", pathname)}
            variant="secondary"
            className="md:border-transparent md:bg-transparent"
          >
            Entrar
          </LinkButton>
          <LinkButton href={withNext("/cadastro", pathname)} className="hidden sm:inline-flex">
            Criar conta
          </LinkButton>
        </div>
      </div>
    </header>
  );
}
