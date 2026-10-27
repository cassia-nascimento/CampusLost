import { describe, expect, it } from "vitest";
import type { ClaimStatus, ItemStatus } from "@/types/domain";
import { getClaimMessages, returnedItemNotice, returnedItemText } from "./claim-messages";

const messages = (claimStatus: ClaimStatus, itemStatus: ItemStatus, returnedAt?: string | null) =>
  getClaimMessages({ claimStatus, itemStatus, returnedAt });

// Meio-dia local: o dia não muda com o fuso do ambiente de teste.
const RETURNED_AT = new Date(2026, 9, 5, 12, 0).toISOString();

describe("pendente", () => {
  it("usa os textos do DESIGN §10", () => {
    const m = messages("pending", "under_claim");
    expect(m.noticeTitle).toBe("Reivindicação pendente");
    expect(m.notice).toBe("Você já reivindicou este item. Acompanhe em Minhas reivindicações.");
    expect(m.nextStep).toEqual({ text: "Aguardando análise da administração." });
    expect(m.blocked).toBe("Você já tem uma reivindicação neste item.");
  });
});

describe("aceita", () => {
  it("item em reivindicação: onde retirar, com destaque 'Aceita!'", () => {
    const m = messages("accepted", "under_claim");
    expect(m.nextStep).toEqual({
      highlight: "Aceita!",
      text: "Procure a administração para retirar o item. Leve o código de retirada.",
    });
    expect(m.notice).toBe("Sua reivindicação foi aceita. Procure a administração para retirar o item. Gere seu código de retirada em Minhas reivindicações.");
    expect(m.blocked).toMatch(/foi aceita/);
  });

  it("sem storedAt (sem permissão): só manda procurar a administração, sem citar local", () => {
    const m = getClaimMessages({ claimStatus: "accepted", itemStatus: "under_claim" });
    expect(m.nextStep.text).toBe("Procure a administração para retirar o item. Leve o código de retirada.");
    expect(m.notice).toBe("Sua reivindicação foi aceita. Procure a administração para retirar o item. Gere seu código de retirada em Minhas reivindicações.");
    expect(JSON.stringify(m)).not.toMatch(/guardado|Guardado|undefined/);
  });

  it("com storedAt: cita onde o item está guardado", () => {
    const m = getClaimMessages({ claimStatus: "accepted", itemStatus: "under_claim", storedAt: "Portaria" });
    expect(m.notice).toBe("Sua reivindicação foi aceita. Procure a administração para retirar o item. Ele está guardado em Portaria. Gere seu código de retirada em Minhas reivindicações.");
    expect(m.nextStep.text).toBe("Procure a administração para retirar o item. Ele está guardado em Portaria. Leve o código de retirada.");
    expect(m.blocked).toBe(m.notice);
  });

  it("item devolvido: não cita local mesmo que storedAt venha", () => {
    const m = getClaimMessages({ claimStatus: "accepted", itemStatus: "returned", storedAt: "Portaria" });
    expect(JSON.stringify(m)).not.toMatch(/guardado|Portaria/);
  });

  it("item devolvido: sem destaque nem instrução de retirar", () => {
    const m = messages("accepted", "returned");
    expect(m.nextStep.highlight).toBeUndefined();
    expect(m.nextStep.text).toBe("Item devolvido.");
    expect(m.notice).toBe("Sua reivindicação foi aceita e a devolução foi registrada.");
    expect(m.nextStep.text + m.notice).not.toMatch(/retirar|Portaria/);
    expect(m.blocked).toBeNull();
  });

  it("item devolvido com data: 'Item devolvido em {data}.'", () => {
    const m = messages("accepted", "returned", RETURNED_AT);
    expect(m.nextStep.text).toBe("Item devolvido em 05/10/2026.");
    expect(m.notice).toBe("Sua reivindicação foi aceita e o item foi devolvido em 05/10/2026.");
  });
});

describe("pendente e recusada nunca citam o local de guarda", () => {
  it.each<[ClaimStatus, ItemStatus]>([
    ["pending", "under_claim"],
    ["rejected", "available"],
    ["rejected", "under_claim"],
    ["rejected", "returned"],
  ])("%s / %s", (claimStatus, itemStatus) => {
    const m = getClaimMessages({ claimStatus, itemStatus, storedAt: "Portaria" });
    expect(JSON.stringify(m)).not.toMatch(/guardado|Guardado|Portaria/);
  });
});

describe("recusada", () => {
  it.each<ItemStatus>(["available", "under_claim"])(
    "item %s: não pode reenviar e orienta procurar a administração",
    (itemStatus) => {
      const m = messages("rejected", itemStatus);
      expect(m.nextStep.text).toBe(
        "A administração recusou esta reivindicação. Você não pode reenviar. Se acha que foi engano, procure a administração.",
      );
      expect(m.notice).toBe(
        "Sua reivindicação foi recusada e não é possível enviar outra para este item. Se acha que foi engano, procure a administração.",
      );
      expect(m.blocked).toBeNull();
    },
  );

  it("item devolvido (a outra pessoa): só informa a recusa, sem falar em reenviar", () => {
    const m = messages("rejected", "returned");
    expect(m.nextStep.text).toBe("A administração recusou esta reivindicação.");
    expect(m.notice).toBe("Sua reivindicação foi recusada.");
    expect(m.nextStep.text + m.notice).not.toMatch(/reenviar|enviar outra/);
  });
});

describe("item devolvido", () => {
  it("aviso do detalhe e frase curta, com e sem data", () => {
    expect(returnedItemNotice(RETURNED_AT)).toBe("Este item já foi devolvido em 05/10/2026.");
    expect(returnedItemNotice(null)).toBe("Este item já foi devolvido.");
    expect(returnedItemText(RETURNED_AT)).toBe("Item devolvido em 05/10/2026.");
    expect(returnedItemText()).toBe("Item devolvido.");
  });
});
