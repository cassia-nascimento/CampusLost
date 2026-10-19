"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { getActiveHref, getBottomNavItems } from "./navigation";
import type { UserRole } from "@/types/domain";

/**
 * Navegação inferior do celular (< 768 px), só nas páginas de topo (DESIGN §6.12).
 * `data-bottomnav` permite ao Toast se posicionar acima dela.
 */
export function BottomNav({ role, pathname }: { role: UserRole; pathname: string }) {
  const items = getBottomNavItems(role);
  const active = getActiveHref(role, pathname);

  return (
    <nav
      aria-label="Principal"
      data-bottomnav
      className="fixed inset-x-0 bottom-0 z-30 bg-surface pb-safe shadow-bar md:hidden"
    >
      <ul className={cn("grid", items.length === 4 ? "grid-cols-4" : "grid-cols-3")}>
        {items.map((item) => {
          const isActive = item.href === active;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.fullLabel}
                className="flex h-(--bottomnav-h) flex-col items-center justify-end gap-0.5 pb-1.5"
              >
                {item.isRegister ? (
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary text-on-primary">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex h-8 w-14 items-center justify-center rounded-full",
                      isActive ? "bg-primary-soft text-primary" : "text-ink-muted",
                    )}
                  >
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className={cn("text-meta", isActive ? "font-semibold text-primary" : "text-ink-muted")}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
