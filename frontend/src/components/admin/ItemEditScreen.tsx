"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BackLink } from "@/components/layout/BackLink";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ACCOUNT_TWO_FACTOR_PATH } from "@/components/account/two-factor";
import { AdminQueryError } from "./AdminQueryError";
import { isTwoFactorRequired } from "./admin-errors";
import { LoadingRegion, Skeleton } from "@/components/ui/Skeleton";
import { ItemStatusBadge } from "@/components/ui/StatusBadge";
import { useServiceQuery } from "@/hooks/use-service-query";
import { ItemForm } from "@/components/items/ItemForm";
import { useToast } from "@/hooks/use-toast";
import type { ItemFormValues } from "@/lib/validation";
import { services, type ItemDetail, type ItemInput } from "@/services";
import { isServiceError } from "@/types/domain";

/** P18: excluir um item remove também as reivindicações dele; a administração é avisada de quantas. */
function claimsRemovalNote(count: number): string {
  return count === 1
    ? "A reivindicação ligada a ele também será removida."
    : `As ${count} reivindicações ligadas a ele também serão removidas.`;
}

/** `/admin/itens/[id]/editar`: editar e excluir item (RF02, AC06.1, P10, P18). */
export function ItemEditScreen({ itemId }: { itemId: string }) {
  const router = useRouter();
  const toast = useToast();
  const query = useServiceQuery(() => services.items.get(itemId), [itemId]);
  // Depois de salvar ou excluir, a tela navega: evita piscar "não encontrado" quando os dados mudam.
  const [leaving, setLeaving] = useState(false);

  /** Administração sem 2FA: leva a /conta (true) em vez de mostrar erro. */
  function redirectIfTwoFactor(error: unknown): boolean {
    if (!isTwoFactorRequired(error)) return false;
    router.replace(ACCOUNT_TWO_FACTOR_PATH);
    return true;
  }

  async function save(input: ItemInput) {
    try {
      await services.items.update(itemId, input);
    } catch (error) {
      if (redirectIfTwoFactor(error)) return;
      throw error;
    }
    setLeaving(true);
    toast.success("Alterações salvas.");
    router.replace(`/itens/${itemId}`);
  }

  async function remove() {
    try {
      await services.items.delete(itemId);
    } catch (error) {
      if (redirectIfTwoFactor(error)) return;
      throw error;
    }
    setLeaving(true);
    toast.success("Item excluído.");
    router.replace("/itens");
  }

  const loading = query.status === "loading" || leaving;

  return (
    <Container size="form">
      <BackLink />
      <PageHeader title="Editar item" />
      {loading ? <EditSkeleton /> : null}
      {!leaving && query.status === "error" && query.error?.code === "NOT_FOUND" ? (
        <EmptyState
          variant="restricted"
          title="Item não encontrado"
          action={<LinkButton href="/itens">Ver itens</LinkButton>}
        >
          Ele pode ter sido excluído.
        </EmptyState>
      ) : null}
      {!leaving && query.status === "error" && query.error?.code !== "NOT_FOUND" ? (
        <AdminQueryError error={query.error} title="Não conseguimos carregar o item" onRetry={query.refetch} />
      ) : null}
      {!leaving && query.status === "success" && query.data ? (
        <EditContent detail={query.data} onSave={save} onDelete={remove} />
      ) : null}
    </Container>
  );
}

function EditContent({
  detail,
  onSave,
  onDelete,
}: {
  detail: ItemDetail;
  onSave: (input: ItemInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { item, viewer } = detail;

  if (!viewer.edit.allowed) {
    return (
      <EmptyState
        variant="restricted"
        title={item.status === "returned" ? "Item devolvido não pode ser editado" : "Não é possível editar este item"}
        action={
          <LinkButton href={`/itens/${item.id}`} variant="secondary">
            Ver item
          </LinkButton>
        }
      >
        {viewer.edit.message}
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-5">
        <ItemStatusBadge status={item.status} size="lg" />
      </div>
      <ItemForm
        key={item.id}
        mode="edit"
        initialValues={{
          title: item.title,
          description: item.description,
          // O serviço valida categoria; aqui só preenchemos o que já está salvo.
          category: item.category as ItemFormValues["category"],
          categoryOther: item.categoryOther ?? "",
          foundLocation: item.foundLocation,
          foundDate: item.foundDate,
          // Administração sempre recebe o valor atual (obrigatório).
          storedAt: item.storedAt ?? "",
        }}
        existingPhotoUrl={item.photoDataUrl ?? null}
        onSubmit={onSave}
        cancelHref={`/itens/${item.id}`}
      >
        {viewer.delete.allowed ? (
          <div className="mt-5">
            <DeleteSection detail={detail} onDelete={onDelete} />
          </div>
        ) : null}
      </ItemForm>
    </>
  );
}

function DeleteSection({ detail, onDelete }: { detail: ItemDetail; onDelete: () => Promise<void> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const claimsCount = detail.claims.length;

  async function confirm() {
    setBusy(true);
    try {
      await onDelete();
      setOpen(false);
    } catch (error) {
      setOpen(false);
      toast.error(
        isServiceError(error)
          ? error.message
          : "Não foi possível excluir o item. Tente de novo em instantes.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="excluir-item" className="border-t border-line pt-6">
      <h2 id="excluir-item" className="text-h3">
        Excluir item
      </h2>
      <p className="mt-2 text-body text-ink-muted">
        Remove o item da busca e não pode ser desfeito.
        {claimsCount > 0 ? ` ${claimsRemovalNote(claimsCount)}` : null}
      </p>
      <div className="mt-4">
        <Button variant="danger-quiet" icon={Trash2} width="mobile-full" onClick={() => setOpen(true)}>
          Excluir item
        </Button>
      </div>
      <ConfirmDialog
        destructive
        open={open}
        onClose={() => setOpen(false)}
        title="Excluir este item?"
        description={
          <>
            <span className="block">“{detail.item.title}” será removido da busca. Esta ação não pode ser desfeita.</span>
            {claimsCount > 0 ? <span className="mt-2 block">{claimsRemovalNote(claimsCount)}</span> : null}
          </>
        }
        confirmLabel="Excluir item"
        confirmingLabel="Excluindo…"
        busy={busy}
        onConfirm={() => void confirm()}
      />
    </section>
  );
}

function EditSkeleton() {
  return (
    <LoadingRegion label="Carregando o item…">
      <Skeleton className="mb-5 h-8 w-40 rounded-full" />
      <div className="flex flex-col gap-5">
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-16 w-full" />
        ))}
      </div>
    </LoadingRegion>
  );
}
