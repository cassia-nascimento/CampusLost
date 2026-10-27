"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  createItemSchema,
  ITEM_CATEGORY_OTHER_MAX,
  ITEM_DESCRIPTION_MAX,
  ITEM_LOCATION_MAX,
  ITEM_STORED_AT_MAX,
  ITEM_TITLE_MAX,
  PHOTO_ACCEPT_ATTR,
  PHOTO_MAX_BYTES,
  validatePhotoFile,
  type ItemFormInput,
  type ItemFormValues,
} from "@/lib/validation";
import type { ItemInput } from "@/services";
import { DEMO_CATEGORIES, isOtherCategory } from "@/types/catalog";
import { isServiceError } from "@/types/domain";
import { CatalogNote } from "./CatalogNote";

const FIELD_NAMES = [
  "title",
  "description",
  "category",
  "categoryOther",
  "foundLocation",
  "foundDate",
  "storedAt",
] as const;
type FieldName = (typeof FIELD_NAMES)[number];

const PHOTO_NOTE = `JPG, PNG ou WebP, até ${PHOTO_MAX_BYTES / (1024 * 1024)} MB`;
const PHOTO_CAPTURE = {
  label: "Tirar foto",
  changeLabel: "Tirar outra foto",
  help: "Se a câmera não abrir neste aparelho, use Enviar foto.",
};

function isFieldName(key: string): key is FieldName {
  return (FIELD_NAMES as readonly string[]).includes(key);
}

export interface ItemFormProps {
  /**
   * `create`: registrar item (RF02). `edit`: edição administrativa. Só muda os textos padrão do botão e
   * das mensagens de falha; as regras (campos, validação) são as mesmas.
   */
  mode: "create" | "edit";
  /**
   * Valores iniciais dos campos (edição). Datas em `YYYY-MM-DD`; `categoryOther` e `storedAt` aceitam `""`/`null`.
   * No modo `create`, `foundDate` começa em hoje. Lido só na montagem: para trocar os valores, remonte o
   * formulário com `key`.
   */
  initialValues?: Partial<ItemFormInput>;
  /** Foto já salva (edição): aparece até ser trocada ou removida. */
  existingPhotoUrl?: string | null;
  /**
   * Chamado com os campos JÁ validados (e com espaços aparados) e a foto:
   *  - `photo: File`      nova foto escolhida;
   *  - `photo: null`      foto removida (na edição, apaga a foto salva);
   *  - `photo` ausente    nada mudou (na edição, mantém a foto salva).
   * O formato é o de `services.items.create(input)` / `services.items.update(id, input)`.
   *
   * Faça a chamada ao serviço aqui e LANCE o erro se falhar: o formulário mostra `fieldErrors` ao lado dos
   * campos, `PHOTO_INVALID` no campo da foto e qualquer outro erro num aviso no topo (com toast), sempre
   * mantendo o que a pessoa digitou. Toasts de sucesso e navegação são de quem usa.
   */
  onSubmit: (input: ItemInput) => Promise<void>;
  /** Destino do botão "Cancelar" (só aparece a partir de `md`; no celular vale o voltar do header). */
  cancelHref: string;
  /** Rótulo do botão principal. Padrão: "Registrar item" (create) / "Salvar alterações" (edit). */
  submitLabel?: string;
  /** Rótulo durante o envio. Padrão: "Registrando…" / "Salvando…". */
  submittingLabel?: string;
  /**
   * Depois que `onSubmit` conclui, o botão continua em "carregando" (a página navega a seguir; evita um
   * segundo envio durante a navegação). Passe `true` se a página permanece aberta e o formulário deve voltar
   * a ficar disponível.
   */
  stayAfterSuccess?: boolean;
  /** Aviso antifraude (DESIGN R1). Padrão: `true`. */
  showAntifraudNotice?: boolean;
  /** Conteúdo extra no fim do formulário, antes da barra de ação (ex.: zona "Excluir item" na edição). */
  children?: ReactNode;
}

/**
 * Formulário de item (RF02/AC02.1–02.2): foto opcional (arquivo ou câmera) com pré-visualização, título,
 * descrição, categoria (com "Especifique a categoria" só em "Outros"), local (texto livre), data (não futura) e
 * onde está guardado (opcional, visível só à administração). Reutilizado na edição administrativa.
 *
 * react-hook-form + `createItemSchema` (mesmas regras do serviço). Erros por campo ligados por
 * `aria-describedby`, foco no primeiro campo inválido e anúncio "Corrija N campos para continuar".
 */
export function ItemForm({
  mode,
  initialValues,
  existingPhotoUrl = null,
  onSubmit,
  cancelHref,
  submitLabel = mode === "create" ? "Registrar item" : "Salvar alterações",
  submittingLabel = mode === "create" ? "Registrando…" : "Salvando…",
  stayAfterSuccess = false,
  showAntifraudNotice = true,
  children,
}: ItemFormProps) {
  const toast = useToast();
  const schema = useMemo(() => createItemSchema(), []);
  const today = toLocalDateString(new Date());
  const failureVerb = mode === "create" ? "registrar o item" : "salvar as alterações";

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    clearErrors,
    control,
    formState: { errors },
  } = useForm<ItemFormInput, unknown, ItemFormValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      description: "",
      categoryOther: "",
      foundLocation: "",
      storedAt: "",
      foundDate: today,
      ...initialValues,
    },
  });
  const description = useWatch({ control, name: "description" }) ?? "";
  const foundLocation = useWatch({ control, name: "foundLocation" }) ?? "";
  const showCategoryOther = isOtherCategory(useWatch({ control, name: "category" }));

  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [photo, setPhoto] = useState<File | null | undefined>(undefined);
  const [photoError, setPhotoError] = useState<string | undefined>(undefined);
  const [photoKey, setPhotoKey] = useState(0); // remonta o FileInput quando a escolha é recusada
  const [formError, setFormError] = useState<{ message: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const photoRef = useRef<HTMLDivElement>(null);
  // Trava síncrona contra envio duplo: `status` só muda na próxima renderização, e dois disparos no mesmo
  // instante (D7) chegariam os dois a `onSubmit`.
  const submittingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  function focusPhotoButton() {
    requestAnimationFrame(() => photoRef.current?.querySelector("button")?.focus());
  }

  function handlePhotoChange(file: File | null) {
    if (file === null) {
      setPhoto(null);
      setPhotoError(undefined);
      return;
    }
    const problem = validatePhotoFile(file);
    if (problem) {
      // Arquivo recusado: volta ao estado de antes (sem pré-visualização do arquivo inválido).
      setPhoto(undefined);
      setPhotoError(problem);
      setPhotoKey((key) => key + 1);
      focusPhotoButton();
      return;
    }
    setPhoto(file);
    setPhotoError(undefined);
  }

  /** Trocar a categoria: fora de "Outros", a especificação some e é limpa (nunca se envia dado inconsistente). */
  function handleCategoryChange(value: string) {
    if (isOtherCategory(value)) {
      setAnnouncement("Novo campo abaixo: Especifique a categoria.");
      return;
    }
    setValue("categoryOther", "");
    clearErrors("categoryOther");
  }

  function handleInvalid(invalid: Record<string, unknown>) {
    const count = Object.keys(invalid).length + (photoError ? 1 : 0);
    setAnnouncement(`Corrija ${count} ${count === 1 ? "campo" : "campos"} para continuar.`);
  }

  function handleFailure(cause: unknown) {
    const error = isServiceError(cause) ? cause : null;

    if (error?.code === "VALIDATION" && error.fieldErrors) {
      let first: FieldName | undefined;
      const others: string[] = [];
      for (const [key, message] of Object.entries(error.fieldErrors)) {
        if (isFieldName(key)) {
          setError(key, { type: "server", message });
          first ??= key;
        } else {
          others.push(message);
        }
      }
      setAnnouncement("Corrija os campos destacados para continuar.");
      if (first) setFocus(first);
      else setFormError({ message: others[0] ?? error.message });
      return;
    }

    if (error?.code === "PHOTO_INVALID") {
      setPhotoError(error.message);
      setPhotoKey((key) => key + 1);
      setPhoto(undefined);
      focusPhotoButton();
      return;
    }

    const specific = error && error.code !== "UNEXPECTED" && error.code !== "NETWORK";
    setFormError({
      message: specific ? error.message : "Tente de novo em instantes. Suas informações foram mantidas.",
    });
    toast.error(`Não foi possível ${failureVerb}.`);
  }

  async function submit(values: ItemFormValues) {
    if (submittingRef.current || status !== "idle") return;
    submittingRef.current = true;
    setStatus("saving");
    setFormError(null);
    try {
      await onSubmit(photo === undefined ? values : { ...values, photo });
      setStatus(stayAfterSuccess ? "idle" : "done");
      // Com `done` a trava continua: a página navega a seguir e não pode haver um segundo envio.
      if (stayAfterSuccess) submittingRef.current = false;
    } catch (cause) {
      submittingRef.current = false;
      setStatus("idle");
      handleFailure(cause);
    }
  }

  const busy = status !== "idle";

  return (
    <form onSubmit={(event) => void handleSubmit(submit, handleInvalid)(event)} noValidate className="flex flex-1 flex-col gap-5">
      <p className="text-body text-ink-muted">
        Todos os campos são obrigatórios, exceto os marcados como (opcional).
      </p>

      {showAntifraudNotice ? (
        <Notice tone="info">
          Não escreva na descrição detalhes que só o dono saberia (número de série, conteúdo, marcas). Eles serão
          perguntados na reivindicação.
        </Notice>
      ) : null}

      {formError ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Notice tone="danger" role="alert" title={`Não foi possível ${failureVerb}.`}>
            {formError.message}
          </Notice>
        </div>
      ) : null}

      <div ref={photoRef}>
        <Field label="Foto" optional error={photoError}>
          <FileInput
            key={photoKey}
            accept={PHOTO_ACCEPT_ATTR}
            existingUrl={existingPhotoUrl}
            note={PHOTO_NOTE}
            addLabel="Enviar foto"
            capture={PHOTO_CAPTURE}
            onChange={handlePhotoChange}
          />
        </Field>
      </div>

      <Field
        label="O que foi encontrado?"
        hint="Ex.: Garrafa térmica, Chaveiro, Fone de ouvido"
        error={errors.title?.message}
      >
        <Input {...register("title")} maxLength={ITEM_TITLE_MAX} autoComplete="off" />
      </Field>

      <Field label="Descrição" hint="Cor, tamanho, estado." error={errors.description?.message}>
        <Textarea {...register("description")} maxLength={ITEM_DESCRIPTION_MAX} currentLength={description.length} />
      </Field>

      <div className="flex flex-col gap-2">
        <Field label="Categoria" error={errors.category?.message}>
          <Select {...register("category", { onChange: (event) => handleCategoryChange(event.target.value) })}>
            <option value="">Selecione…</option>
            {DEMO_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Field>
        {showCategoryOther ? (
          <Field
            label="Especifique a categoria"
            hint={`Ex.: Crachá de visitante. Até ${ITEM_CATEGORY_OTHER_MAX} caracteres.`}
            error={errors.categoryOther?.message}
          >
            <Input {...register("categoryOther")} maxLength={ITEM_CATEGORY_OTHER_MAX} autoComplete="off" />
          </Field>
        ) : null}
        <CatalogNote />
      </div>

      <Field
        label="Onde foi encontrado?"
        hint={`Bloco, andar, sala ou ponto de referência. ${foundLocation.length}/${ITEM_LOCATION_MAX}`}
        error={errors.foundLocation?.message}
      >
        <Input
          {...register("foundLocation")}
          maxLength={ITEM_LOCATION_MAX}
          autoComplete="off"
          placeholder="Ex.: Bloco C, 2º andar, lab. 04"
        />
      </Field>

      <Field label="Quando foi encontrado?" error={errors.foundDate?.message}>
        <Input type="date" max={today} {...register("foundDate")} />
      </Field>

      <Field
        label="Onde está guardado agora?"
        optional
        hint="Opcional. Só a administração vê esta informação; ela não aparece para outras pessoas."
        error={errors.storedAt?.message}
      >
        <Input {...register("storedAt")} maxLength={ITEM_STORED_AT_MAX} placeholder="Ex.: Portaria" autoComplete="off" />
      </Field>

      {children}

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <ActionBar>
        <LinkButton href={cancelHref} variant="secondary" size="lg" width="mobile-full" className="max-md:hidden">
          Cancelar
        </LinkButton>
        <Button type="submit" size="lg" width="mobile-full" loading={busy} loadingText={submittingLabel}>
          {submitLabel}
        </Button>
      </ActionBar>
    </form>
  );
}
