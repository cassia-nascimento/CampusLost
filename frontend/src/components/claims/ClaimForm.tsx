"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/use-toast";
import { CLAIM_PROOF_MAX, CLAIM_WHERE_WHEN_MAX, claimSchema, type ClaimFormValues } from "@/lib/validation";
import { services } from "@/services";
import { isServiceError, type ItemStatus } from "@/types/domain";

/** Erros que significam "o estado do item mudou e você não pode mais reivindicar" (a regra é do serviço). */
const BLOCKING_CODES = ["DUPLICATE_CLAIM", "CLAIM_BLOCKED", "ITEM_RETURNED", "FORBIDDEN", "EMAIL_NOT_VERIFIED"];

export interface ClaimFormProps {
  itemId: string;
  itemStatus: ItemStatus;
  /** Chamado quando o serviço aceitou a reivindicação, antes de navegar. */
  onSent: () => void;
  /** Pede que a tela releia o item (o bloqueio pode ter mudado). */
  onBlocked: () => void;
}

/**
 * Formulário de reivindicação (RF04 / P7): duas perguntas obrigatórias, sem chat. Só é montado quando
 * o serviço já disse que o usuário pode reivindicar (`viewer.claim.allowed`); se a situação mudar
 * antes do envio, o serviço recusa e a tela explica o motivo.
 */
export function ClaimForm({ itemId, itemStatus, onSent, onBlocked }: ClaimFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClaimFormValues>({
    resolver: zodResolver(claimSchema),
    mode: "onTouched",
    defaultValues: { proofDetails: "", lostWhereWhen: "" },
  });
  const proofLength = (useWatch({ control, name: "proofDetails" }) ?? "").length;

  async function onSubmit(values: ClaimFormValues) {
    setFormError(null);
    setAnnouncement("");
    try {
      await services.claims.create(itemId, values);
    } catch (error) {
      if (isServiceError(error)) {
        if (error.code === "VALIDATION" && error.fieldErrors) {
          for (const field of ["proofDetails", "lostWhereWhen"] as const) {
            const message = error.fieldErrors[field];
            if (message) setError(field, { type: "server", message });
          }
          return;
        }
        if (BLOCKING_CODES.includes(error.code)) {
          toast.error(error.message);
          onBlocked();
          return;
        }
      }
      setFormError("Não foi possível enviar a reivindicação. Tente de novo em instantes. Suas respostas foram mantidas.");
      toast.error("Não foi possível enviar a reivindicação. Suas respostas foram mantidas.");
      return;
    }
    onSent();
    toast.success("Reivindicação enviada. A administração vai analisar.");
    router.replace("/minhas-reivindicacoes");
  }

  function onInvalid(fieldErrors: Record<string, unknown>) {
    const count = Object.keys(fieldErrors).length;
    setAnnouncement(`Corrija ${count} ${count === 1 ? "campo" : "campos"} para continuar.`);
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="mt-6 flex flex-1 flex-col">
      <div className="flex flex-col gap-5">
        <p className="text-body text-ink-muted">
          Responda com detalhes que só o dono saberia. A administração compara suas respostas com o item guardado.
        </p>

        {formError ? (
          <Notice tone="danger" role="alert">
            {formError}
          </Notice>
        ) : null}

        <Field
          label="Que detalhes só o dono saberia?"
          hint="Ex.: marcas, riscos, objetos dentro, capa. Não repita a descrição pública."
          error={errors.proofDetails?.message}
        >
          <Textarea maxLength={CLAIM_PROOF_MAX} currentLength={proofLength} {...register("proofDetails")} />
        </Field>

        <Field
          label="Onde e quando você perdeu?"
          hint="Ex.: Biblioteca, na terça à tarde."
          error={errors.lostWhereWhen?.message}
        >
          <Input maxLength={CLAIM_WHERE_WHEN_MAX} autoComplete="off" {...register("lostWhereWhen")} />
        </Field>

        <Notice tone="info">
          {itemStatus === "available"
            ? "Ao enviar, o item passa para “Em reivindicação”."
            : "Este item já está “Em reivindicação”. Sua reivindicação será analisada junto com as outras."}
        </Notice>

        <p role="status" className="sr-only">
          {announcement}
        </p>
      </div>

      <ActionBar>
        <LinkButton href={`/itens/${itemId}`} variant="secondary" size="lg" className="max-sm:hidden">
          Cancelar
        </LinkButton>
        <Button type="submit" size="lg" width="mobile-full" loading={isSubmitting} loadingText="Enviando…">
          Enviar reivindicação
        </Button>
      </ActionBar>
    </form>
  );
}
