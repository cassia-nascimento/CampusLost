"use client";

import { useRouter } from "next/navigation";
import { BackLink } from "@/components/layout/BackLink";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { services, type ItemInput } from "@/services";
import { ItemForm } from "./ItemForm";

/** Tela `/itens/novo` (RF02): qualquer pessoa logada registra um item encontrado. */
export function NewItemScreen() {
  const router = useRouter();
  const toast = useToast();

  async function handleSubmit(input: ItemInput) {
    const item = await services.items.create(input);
    toast.success("Item registrado. Ele já aparece na busca.");
    // `replace`: voltar não deve reabrir o formulário já enviado.
    router.replace(`/itens/${item.id}`);
  }

  return (
    <Container size="form">
      <BackLink />
      <PageHeader title="Registrar item" />
      <ItemForm mode="create" onSubmit={handleSubmit} cancelHref="/itens" />
    </Container>
  );
}
