import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { Notice } from "@/components/ui/Notice";

/** Lacuna que a equipe precisa preencher: aparece destacada para ninguém publicar o texto sem revisar. */
export function ToDefine({ children }: { children: ReactNode }) {
  return <mark className="rounded-sm bg-warning-bg px-1 font-semibold text-warning-fg">[A definir pela equipe: {children}]</mark>;
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8 flex flex-col gap-3">
      <h2 id={id} className="text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}

export const LEGAL_LIST = "flex list-disc flex-col gap-1.5 pl-6 text-body";

/** Layout compartilhado dos textos legais (`/privacidade`, `/termos`): título, subtítulo e aviso de texto-modelo. */
export function LegalDocument({
  title,
  subtitle,
  notice,
  children,
}: {
  title: string;
  subtitle: string;
  notice: ReactNode;
  children: ReactNode;
}) {
  return (
    <Container size="form">
      <h1>{title}</h1>
      <p className="mt-2 text-body text-ink-muted">{subtitle}</p>
      <Notice tone="warning" title="Texto-modelo, a ser revisado pela equipe" className="mt-6">
        {notice}
      </Notice>
      {children}
    </Container>
  );
}
