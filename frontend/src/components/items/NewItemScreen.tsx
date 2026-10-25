"use client";

import { useRouter } from "next/navigation";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSession } from "@/hooks/use-session";
import { useToast } from "@/hooks/use-toast";
import { checkEmailVerified } from "@/lib/rules";
import { services, type ItemInput } from "@/services";
import { ItemForm } from "./ItemForm";

/** Tela `/itens/novo` (RF02): qualquer pessoa logada com e-mail confirmado registra um item encontrado. */
export function NewItemScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();
  const verification = checkEmailVerified(user);

  async function handleSubmit(input: ItemInput) {
    const item = await services.items.create(input);
    toast.success("Item registrado. Ele já aparece na busca.");
    // `replace`: voltar não deve reabrir o formulário já enviado.
    router.replace(`/itens/${item.id}`);
  }

  return (
    <Container size="form">
      <PageHeader title="Registrar item" />
      {user && !verification.allowed ? (
        <EmptyState
          variant="restricted"
          title="Confirme seu e-mail para registrar itens"
          action={
            <div className="flex flex-col items-stretch gap-3">
              <ResendVerification />
              <LinkButton href="/itens" variant="ghost">
                Ver itens
              </LinkButton>
            </div>
          }
        >
          {verification.message} Abra o link que enviamos para o seu e-mail ou peça outro.
        </EmptyState>
      ) : (
        <ItemForm mode="create" onSubmit={handleSubmit} cancelHref="/itens" />
      )}
    </Container>
  );
}
