"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ActionBar } from "@/components/layout/ActionBar";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { FileInput } from "@/components/ui/FileInput";
import { Input } from "@/components/ui/Input";
import { Notice } from "@/components/ui/Notice";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/use-toast";
import { toLocalDateString } from "@/lib/rules";
import { PHOTO_ACCEPT_ATTR, itemSchema, validatePhotoFile, type ItemFormValues } from "@/lib/validation";
import type { ItemInput } from "@/services";
import { CATALOG_DEMO_NOTICE, DEMO_CATEGORIES, DEMO_LOCATIONS } from "@/types/catalog";
import { isServiceError, type Item } from "@/types/domain";

const FIELD_NAMES = ["title", "description", "category", "foundLocation", "foundDate", "storedAt"] as const;
type FieldName = (typeof FIELD_NAMES)[number];

function isFieldName(name: string): name is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(name);
}

export interface ItemEditFormProps {
  item: Item;
  /** Salva as alterações (chama o serviço). Lançar `ServiceError` mostra o erro no formulário. */
  onSave: (input: ItemInput) => Promise<void>;
  /** Para onde "Cancelar" leva. */
  cancelHref: string;
  /** Conteúdo extra antes da barra de ação (ex.: a seção "Excluir item"). */
  children?: ReactNode;
}

/**
 * Formulário de edição de item (RF02, administração). Mesmos campos do registro; a foto segue o contrato
 * do serviço: `undefined` mantém, `File` troca, `null` remove (SPEC §3 / `ItemInput`).
 * Autocontido na T08; a unificação com o formulário de registro será avaliada na revisão.
 */
export function ItemEditForm({ item, onSave, cancelHref, children }: ItemEditFormProps) {
  const toast = useToast();
  const [today] = useState(() => toLocalDateString(new Date()));
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    mode: "onTouched",
    defaultValues: {
      title: item.title,
      description: item.description,
      category: item.category as ItemFormValues["category"],
      foundLocation: item.foundLocation as ItemFormValues["foundLocation"],
      foundDate: item.foundDate,
      storedAt: item.storedAt,
    },
  });
  const descriptionLength = (useWatch({ control, name: "description" }) ?? "").length;

  function handlePhotoChange(file: File | null) {
    if (file === null) {
      setPhoto(null);
      setPhotoError(null);
      return;
    }
    const problem = validatePhotoFile(file);
    setPhotoError(problem);
    setPhoto(problem ? undefined : file);
  }

  const submit = handleSubmit(
    async (values) => {
      setAnnouncement("");
      if (photoError) {
        setFormError("Corrija a foto para salvar.");
        return;
      }
      setFormError(null);
      try {
        await onSave({ ...values, ...(photo !== undefined ? { photo } : {}) });
      } catch (error) {
        if (!isServiceError(error)) {
          const message = "Não foi possível salvar as alterações. Tente de novo em instantes. Suas alterações foram mantidas.";
          setFormError(message);
          toast.error(message);
          return;
        }
        let focused = false;
        for (const [name, message] of Object.entries(error.fieldErrors ?? {})) {
          if (isFieldName(name)) {
            setError(name, { message }, { shouldFocus: !focused });
            focused = true;
          }
        }
        if (error.code === "PHOTO_INVALID") setPhotoError(error.message);
        if (!focused && error.code !== "PHOTO_INVALID") {
          setFormError(`${error.message} Suas alterações foram mantidas.`);
          toast.error(error.message);
        }
      }
    },
    (invalid) => {
      const count = Object.keys(invalid).length;
      setAnnouncement(`Corrija ${count === 1 ? "1 campo" : `${count} campos`} para continuar.`);
    },
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5">
        <p className="text-meta text-ink-muted">
          Todos os campos são obrigatórios, exceto os marcados como (opcional).
        </p>
        {formError ? (
          <Notice tone="danger" role="alert">
            {formError}
          </Notice>
        ) : null}
        <p role="status" className="sr-only">
          {announcement}
        </p>
        <Notice tone="info">
          Não escreva na descrição detalhes que só o dono saberia (número de série, conteúdo, marcas). Eles serão
          perguntados na reivindicação.
        </Notice>

        <Field label="Foto" optional error={photoError ?? undefined}>
          <FileInput
            accept={PHOTO_ACCEPT_ATTR}
            note="JPG, PNG ou WebP, até 10 MB"
            existingUrl={item.photoDataUrl ?? null}
            onChange={handlePhotoChange}
          />
        </Field>
        <Field label="O que foi encontrado?" hint="Ex.: Garrafa térmica, Chaveiro, Fone de ouvido." error={errors.title?.message}>
          <Input maxLength={80} autoComplete="off" {...register("title")} />
        </Field>
        <Field label="Descrição" hint="Cor, tamanho, estado." error={errors.description?.message}>
          <Textarea maxLength={500} currentLength={descriptionLength} {...register("description")} />
        </Field>
        <Field label="Categoria" hint={CATALOG_DEMO_NOTICE} error={errors.category?.message}>
          <Select {...register("category")}>
            {DEMO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Onde foi encontrado?" error={errors.foundLocation?.message}>
          <Select {...register("foundLocation")}>
            {DEMO_LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quando foi encontrado?" error={errors.foundDate?.message}>
          <Input type="date" max={today} {...register("foundDate")} />
        </Field>
        <Field label="Onde está guardado agora?" hint="Para o dono saber onde retirar." error={errors.storedAt?.message}>
          <Input maxLength={120} autoComplete="off" {...register("storedAt")} />
        </Field>
      </div>

      {children ? <div className="mt-10">{children}</div> : null}

      <ActionBar>
        <LinkButton href={cancelHref} variant="secondary" size="lg" width="mobile-full">
          Cancelar
        </LinkButton>
        <Button type="submit" size="lg" width="mobile-full" loading={isSubmitting} loadingText="Salvando…">
          Salvar alterações
        </Button>
      </ActionBar>
    </form>
  );
}
