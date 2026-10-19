"use client";

import { ImagePlus } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "./Button";
import { useFieldControl } from "./Field";
import { Photo } from "./Photo";

export interface FileInputProps {
  /** Tipos aceitos (atributo `accept`), ex.: `PHOTO_ACCEPT_ATTR`. Sem `capture`: o celular oferece câmera ou galeria. */
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
}

/**
 * Seleção de foto com pré-visualização (DESIGN §6.2). O `<input type="file">` fica oculto e o botão
 * visível o aciona (nome acessível vem do `Field`). O estado do arquivo é interno: use `key` para reiniciar.
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
}: FileInputProps) {
  const control = useFieldControl({});
  const inputRef = useRef<HTMLInputElement>(null);
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
            <Button variant="ghost" onClick={handleRemove}>
              {removeLabel}
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button {...control} variant="secondary" icon={ImagePlus} onClick={() => inputRef.current?.click()}>
            {addLabel}
          </Button>
          {note ? <p className="text-meta text-ink-muted">{note}</p> : null}
        </div>
      )}
    </div>
  );
}
