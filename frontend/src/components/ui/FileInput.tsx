"use client";

import { Camera, ImagePlus } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { Button } from "./Button";
import { useFieldControl, useFieldLabelId } from "./Field";
import { Photo } from "./Photo";

export interface FileInputProps {
  /** Tipos aceitos (atributo `accept`), ex.: `PHOTO_ACCEPT_ATTR`. O botão principal não usa `capture`: o celular oferece câmera ou galeria. */
  accept: string;
  /** Recebe o arquivo escolhido, ou `null` ao remover. A validação (tipo/tamanho) é de quem usa. */
  onChange: (file: File | null) => void;
  /** Foto já salva (edição). Aparece até ser trocada ou removida. */
  existingUrl?: string | null;
  /** Texto ao lado do botão, ex.: "JPG, PNG ou WebP, até 2 MB". */
  note?: string;
  addLabel?: string;
  changeLabel?: string;
  removeLabel?: string;
  /** Rótulo da pré-visualização para leitores de tela. */
  previewAlt?: string;
  /**
   * Habilita a segunda ação "Tirar foto": outro `<input type="file" accept="image/*" capture="environment">`, recurso
   * nativo do navegador (sem `getUserMedia`). Sem suporte a `capture` (ex.: desktop), cai num seletor de arquivo comum.
   * O arquivo vai para o mesmo `onChange`, então a validação de quem usa vale para as duas ações.
   */
  capture?: {
    label: string;
    /** Rótulo da ação quando já há foto. */
    changeLabel: string;
    /** Ajuda sob os botões (o que fazer se a câmera não abrir). Ligada aos botões por `aria-describedby`. */
    help: string;
  };
}

/**
 * Seleção de foto com pré-visualização (DESIGN §6.2). O `<input type="file">` fica oculto e o botão
 * visível o aciona. O nome acessível do botão junta o rótulo do `Field` e a própria ação ("Foto (opcional)
 * Adicionar foto"), para o leitor de tela não anunciar só o rótulo nos dois estados. O estado do arquivo é
 * interno: use `key` para reiniciar.
 */
export function FileInput({
  accept,
  onChange,
  existingUrl = null,
  note,
  addLabel = "Adicionar foto",
  changeLabel = "Trocar foto",
  removeLabel = "Remover foto",
  previewAlt = "Pré-visualização da foto escolhida",
  capture,
}: FileInputProps) {
  const fieldControl = useFieldControl({});
  const labelId = useFieldLabelId();
  // O botão com o `id` do campo se referencia a si mesmo: o nome fica "<rótulo> <texto do botão>".
  const control = {
    ...fieldControl,
    "aria-labelledby": labelId && fieldControl.id ? `${labelId} ${fieldControl.id}` : undefined,
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const cameraButtonId = useId();
  const helpId = useId();
  const [selected, setSelected] = useState<{ name: string; url: string } | null>(null);
  const [removedExisting, setRemovedExisting] = useState(false);

  const previewUrl = selected?.url ?? (removedExisting ? null : existingUrl);

  function replace(next: { name: string; url: string } | null) {
    if (selected) URL.revokeObjectURL(selected.url);
    setSelected(next);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    replace({ name: file.name, url: URL.createObjectURL(file) });
    onChange(file);
  }

  function handleRemove() {
    replace(null);
    setRemovedExisting(true);
    onChange(null);
  }

  // Segundo botão: não é o controle do rótulo do `Field`, mas ganha o mesmo nome ("Foto (opcional) Tirar foto").
  const cameraControl = {
    id: cameraButtonId,
    "aria-labelledby": labelId ? `${labelId} ${cameraButtonId}` : undefined,
    "aria-describedby": helpId,
  };
  const help = capture ? (
    <p id={helpId} className="text-meta text-ink-muted">
      {capture.help}
    </p>
  ) : null;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />
      {capture ? (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleChange}
        />
      ) : null}
      {previewUrl ? (
        <>
          <Photo src={previewUrl} alt={previewAlt} aspect="landscape" className="w-full max-w-80 rounded-md" />
          {selected ? <p className="text-meta break-all text-ink-muted">{selected.name}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              {...control}
              variant="ghost"
              icon={ImagePlus}
              onClick={() => inputRef.current?.click()}
            >
              {changeLabel}
            </Button>
            {capture ? (
              <Button {...cameraControl} variant="ghost" icon={Camera} onClick={() => cameraRef.current?.click()}>
                {capture.changeLabel}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={handleRemove}>
              {removeLabel}
            </Button>
          </div>
          {help}
        </>
      ) : (
        <>
          {/* Lado a lado a partir de `sm`; empilhados (largura total) no celular. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              {...control}
              variant="secondary"
              icon={ImagePlus}
              onClick={() => inputRef.current?.click()}
              width="mobile-full"
            >
              {addLabel}
            </Button>
            {capture ? (
              <Button
                {...cameraControl}
                variant="secondary"
                icon={Camera}
                onClick={() => cameraRef.current?.click()}
                width="mobile-full"
              >
                {capture.label}
              </Button>
            ) : null}
          </div>
          {note ? <p className="text-meta text-ink-muted">{note}</p> : null}
          {help}
        </>
      )}
    </div>
  );
}
