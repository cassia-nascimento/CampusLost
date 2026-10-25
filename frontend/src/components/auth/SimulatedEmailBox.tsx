import Link from "next/link";
import { Notice } from "@/components/ui/Notice";

/**
 * Caixa "Ambiente simulado": no mock nenhum e-mail sai, então o link que iria na mensagem é mostrado aqui.
 * Na API real `devLink` não existe e o componente não aparece.
 */
export function SimulatedEmailBox({
  devLink,
  action,
  className,
}: {
  devLink: string | null | undefined;
  /** Texto do link, ex.: "Abrir link de confirmação". */
  action: string;
  className?: string;
}) {
  if (!devLink) return null;
  return (
    <Notice tone="neutral" title="Ambiente simulado" className={className}>
      <p>Nenhum e-mail foi enviado de verdade. Use o link abaixo no lugar da mensagem.</p>
      <Link href={devLink} className="link touch-target mt-1 inline-flex items-center font-semibold">
        {action}
      </Link>
    </Notice>
  );
}
