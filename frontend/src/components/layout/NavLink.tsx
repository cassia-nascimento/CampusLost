import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Link da navegação do header (≥ 768 px): ocupa a altura toda e o item ativo ganha o indicador de 3 px. */
export function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-full items-center px-3 text-body font-semibold transition-colors hover:text-primary",
        // O indicador de 3 px cresce da esquerda ao passar o mouse; no item ativo já está inteiro.
        "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:origin-left after:bg-primary",
        "after:transition-transform after:duration-200 after:ease-standard",
        active ? "text-ink after:scale-x-100" : "text-ink-muted after:scale-x-0 hover:after:scale-x-100",
      )}
    >
      {children}
    </Link>
  );
}
