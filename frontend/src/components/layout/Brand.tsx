import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca (etiqueta) + wordmark "CampusLost" montado em HTML para usar a fonte auto-hospedada (DESIGN §2.2). */
export function Brand({ href, className, markSize = 28 }: { href: string; className?: string; markSize?: number }) {
  return (
    <Link
      href={href}
      className={cn("touch-target inline-flex items-center gap-2 rounded-md font-display text-lead font-bold", className)}
    >
      <Image src="/brand/logo-mark.svg" alt="" width={markSize} height={markSize} priority />
      <span className="tracking-tight">
        <span className="text-ink">Campus</span>
        <span className="text-primary">Lost</span>
      </span>
      <span className="sr-only"> — página inicial</span>
    </Link>
  );
}
