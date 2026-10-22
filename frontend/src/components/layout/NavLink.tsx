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
        "relative flex h-full items-center px-3 text-body font-semibold hover:text-primary",
        active ? "text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-primary" : "text-ink-muted",
      )}
    >
      {children}
    </Link>
  );
}
