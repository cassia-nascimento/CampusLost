import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ícone giratório decorativo; quem o usa precisa expor o estado de carregamento por texto. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden="true" className={cn("size-5 animate-spin", className)} />;
}
