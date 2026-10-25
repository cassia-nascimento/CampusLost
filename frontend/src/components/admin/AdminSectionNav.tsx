import Link from "next/link";
import { cn } from "@/lib/utils";
import { ADMIN_SECTIONS } from "@/components/layout/navigation";

/** Faixa para alternar entre Usuários, Convites e Auditoria (as seções de gestão não estão no BottomNav). */
export function AdminSectionNav({ current }: { current: string }) {
  return (
    <nav aria-label="Gestão da administração" className="mb-6">
      <ul className="flex flex-wrap gap-2">
        {ADMIN_SECTIONS.map(({ href, label, icon: Icon }) => {
          const active = href === current;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "touch-target inline-flex items-center gap-2 rounded-full border px-4 text-body font-semibold",
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line-strong bg-surface text-ink-muted hover:bg-primary-soft hover:text-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
