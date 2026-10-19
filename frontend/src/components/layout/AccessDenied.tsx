"use client";

import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { ROLE_LABEL, type UserRole } from "@/types/domain";
import { Container } from "./Container";

/** Tela "Acesso restrito" (DESIGN §9.12): explica o motivo e leva a uma página permitida. */
export function AccessDenied({ role }: { role: UserRole }) {
  // O `metadata` da rota diz "Painel"/"Devoluções"; a aba deve refletir o que a pessoa de fato vê.
  useDocumentTitle("Acesso restrito");
  return (
    <Container size="form">
      <EmptyState
        variant="restricted"
        headingLevel={1}
        title="Acesso restrito"
        action={<LinkButton href="/itens">Voltar para os itens</LinkButton>}
      >
        <p>Esta área é só para a administração. Você entrou como {ROLE_LABEL[role]}.</p>
      </EmptyState>
    </Container>
  );
}
