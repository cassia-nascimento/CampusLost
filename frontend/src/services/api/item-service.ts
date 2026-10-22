import { validatePhotoFile } from "@/lib/validation/photo";
import { ServiceError } from "@/types/domain";
import type { ItemInput, ItemService } from "../contracts";
import type { HttpClient } from "./http";
import { asArray, type Mappers } from "./mappers";

/** Campos de texto + foto em `multipart/form-data`. `photo`: arquivo = envia; `null` = remove (só na edição); ausente = mantém. */
export function buildItemForm(input: ItemInput, mode: "create" | "update"): FormData {
  const form = new FormData();
  form.append("title", input.title);
  form.append("description", input.description);
  form.append("category", input.category);
  form.append("foundLocation", input.foundLocation);
  form.append("foundDate", input.foundDate);
  form.append("storedAt", input.storedAt);
  if (input.photo) {
    const problem = validatePhotoFile(input.photo);
    if (problem) throw new ServiceError("PHOTO_INVALID", problem);
    form.append("photo", input.photo, input.photo.name || "foto");
  } else if (input.photo === null && mode === "update") {
    form.append("removePhoto", "true");
  }
  return form;
}

export function createItemService(http: HttpClient, mappers: Mappers, changed: () => void): ItemService {
  const enc = encodeURIComponent;
  return {
    async list(filters) {
      const raw = await http.request("GET", "/items", {
        query: {
          category: filters?.category,
          location: filters?.location,
          from: filters?.from,
          to: filters?.to,
          status: filters?.status,
          sort: filters?.sort,
        },
      });
      return asArray(raw, "itens").map(mappers.itemView);
    },

    async get(id) {
      return mappers.itemDetail(await http.request("GET", `/items/${enc(id)}`));
    },

    async create(input) {
      const created = mappers.item(await http.request("POST", "/items", { form: buildItemForm(input, "create") }));
      changed();
      return created;
    },

    async update(id, input) {
      const updated = mappers.item(await http.request("PUT", `/items/${enc(id)}`, { form: buildItemForm(input, "update") }));
      changed();
      return updated;
    },

    async delete(id) {
      await http.request("DELETE", `/items/${enc(id)}`);
      changed();
    },
  };
}
