import type { ReactNode, Ref } from "react";
import { Brand } from "@/components/layout/Brand";

/**
 * Moldura das telas públicas de conta (`/cadastro`, `/esqueci-senha`, `/redefinir-senha`, `/verificar-email`):
 * no celular ocupa a tela; a partir de `md` vira um cartão centralizado. O `h1` aceita `headingRef` para
 * receber o foco quando a tela troca de etapa.
 */
export function AuthCard({
  title,
  description,
  headingRef,
  children,
}: {
  title: string;
  description?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-form flex-1 flex-col px-gutter pt-6 pb-10 md:py-12">
      <div className="flex flex-1 flex-col md:flex-none md:rounded-xl md:bg-surface md:p-8 md:shadow-card">
        <Brand href="/entrar" className="-ml-1 self-start" markSize={32} />
        <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="mt-4 text-display outline-none">
          {title}
        </h1>
        {description ? <div className="mt-3 text-lead font-normal text-ink-muted">{description}</div> : null}
        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
