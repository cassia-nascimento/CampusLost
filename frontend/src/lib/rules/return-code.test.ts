import { describe, expect, it } from "vitest";
import {
  RETURN_CODE_ALPHABET,
  RETURN_CODE_LENGTH,
  RETURN_CODE_LOCK_MS,
  RETURN_CODE_MAX_ATTEMPTS,
  RETURN_CODE_VERIFY_TTL_MS,
  attemptReturnCode,
  canIssueReturnCode,
  canVerifyReturnCode,
  checkReturnCodeForDelivery,
  formatReturnCode,
  generateReturnCode,
  isReturnCodeVerified,
  isWellFormedReturnCode,
  normalizeReturnCode,
  returnCodeAttemptsLeft,
  returnCodeLockedMessage,
  returnCodeVerifiedUntil,
  wrongReturnCodeMessage,
  type ReturnCodeState,
} from "./return-code";
import { admin, makeClaim, makeItem, NOW, otherStudent, student } from "./test-fixtures";

const underClaim = makeItem({ status: "under_claim" });
const accepted = makeClaim({ status: "accepted", claimantId: student.id });
const fresh: ReturnCodeState = { failedAttempts: 0, lockedUntil: null, verifiedAt: null, usedAt: null };
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("alfabeto e limites", () => {
  it("30 símbolos sem 0, 1, I, L, O e U; limites do contrato", () => {
    expect(RETURN_CODE_ALPHABET).toBe("23456789ABCDEFGHJKMNPQRSTVWXYZ");
    expect(RETURN_CODE_ALPHABET).toHaveLength(30);
    for (const ambiguous of "01ILOU") expect(RETURN_CODE_ALPHABET).not.toContain(ambiguous);
    expect(RETURN_CODE_LENGTH).toBe(8);
    expect(RETURN_CODE_MAX_ATTEMPTS).toBe(5);
    expect(RETURN_CODE_LOCK_MS).toBe(15 * 60_000);
    expect(RETURN_CODE_VERIFY_TTL_MS).toBe(15 * 60_000);
  });
});

describe("geração", () => {
  it("usa só o alfabeto e tem 8 caracteres", () => {
    for (let n = 0; n < 50; n++) {
      const code = generateReturnCode((length) => crypto.getRandomValues(new Uint8Array(length)));
      expect(isWellFormedReturnCode(code)).toBe(true);
    }
  });

  it("rejeita bytes ≥ 240 (sem viés de módulo) e mapeia o resto pelo alfabeto", () => {
    // 255, 250 e 240 são descartados; 0 → '2', 29 → 'Z', 30 → '2' (30 % 30 = 0), 1..5 → '3'..'7'
    const bytes = [255, 250, 240, 0, 29, 30, 1, 2, 3, 4, 5, 6];
    const code = generateReturnCode((length) => Uint8Array.from(bytes.slice(0, length).concat(Array(length).fill(0))));
    expect(code).toBe("2Z234567");
  });

  it("repete o sorteio quando os bytes não bastam", () => {
    let calls = 0;
    const code = generateReturnCode((length) => {
      calls++;
      return calls === 1 ? new Uint8Array(length).fill(255) : new Uint8Array(length).fill(1);
    });
    expect(calls).toBe(2);
    expect(code).toBe("33333333");
  });
});

describe("formato e normalização", () => {
  it("exibe XXXX-XXXX", () => {
    expect(formatReturnCode("K7M29QXB")).toBe("K7M2-9QXB");
  });

  it("normaliza: maiúsculas, sem espaços e sem hífens", () => {
    expect(normalizeReturnCode("k7m2-9qxb")).toBe("K7M29QXB");
    expect(normalizeReturnCode("  K7M2 9QXB ")).toBe("K7M29QXB");
    expect(normalizeReturnCode("k7m2–9qxb")).toBe("K7M29QXB");
    expect(normalizeReturnCode("")).toBe("");
  });

  it("confere tamanho e alfabeto", () => {
    expect(isWellFormedReturnCode("K7M29QXB")).toBe(true);
    expect(isWellFormedReturnCode("K7M29QX")).toBe(false);
    expect(isWellFormedReturnCode("K7M29QX0")).toBe(false); // 0 fora do alfabeto
    expect(isWellFormedReturnCode("K7M29QXBB")).toBe(false);
  });
});

describe("canIssueReturnCode", () => {
  it("só o autor, com reivindicação aceita e item Em reivindicação", () => {
    expect(canIssueReturnCode(student, underClaim, accepted)).toEqual({ allowed: true });
  });

  it("outro usuário, administração e visitante não", () => {
    expect(canIssueReturnCode(otherStudent, underClaim, accepted)).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(canIssueReturnCode(admin, underClaim, accepted)).toMatchObject({ allowed: false, code: "FORBIDDEN" });
    expect(canIssueReturnCode(null, underClaim, accepted)).toMatchObject({ allowed: false, code: "UNAUTHENTICATED" });
  });

  it("pendente, recusada ou item devolvido: INVALID_TRANSITION com a mensagem do contrato", () => {
    const message = "Só reivindicações aceitas, de itens aguardando devolução, têm código de retirada.";
    for (const status of ["pending", "rejected"] as const) {
      expect(canIssueReturnCode(student, underClaim, makeClaim({ status, claimantId: student.id }))).toEqual({
        allowed: false,
        code: "INVALID_TRANSITION",
        message,
      });
    }
    expect(canIssueReturnCode(student, makeItem({ status: "returned" }), accepted)).toMatchObject({ code: "INVALID_TRANSITION", message });
  });
});

describe("canVerifyReturnCode", () => {
  it("administração, reivindicação aceita e item Em reivindicação", () => {
    expect(canVerifyReturnCode(admin, underClaim, accepted)).toEqual({ allowed: true });
  });

  it("usuário, visitante, pendente e item devolvido não", () => {
    expect(canVerifyReturnCode(student, underClaim, accepted)).toMatchObject({ code: "FORBIDDEN" });
    expect(canVerifyReturnCode(null, underClaim, accepted)).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(canVerifyReturnCode(admin, underClaim, makeClaim({ status: "pending" }))).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(canVerifyReturnCode(admin, makeItem({ status: "returned" }), accepted)).toMatchObject({ code: "ITEM_RETURNED" });
  });
});

describe("tentativas e bloqueio", () => {
  it("erro desconta uma tentativa e informa as restantes", () => {
    const r = attemptReturnCode(fresh, false, NOW);
    expect(r).toMatchObject({ outcome: "wrong", attemptsLeft: 4 });
    expect(r.next.failedAttempts).toBe(1);
    expect(wrongReturnCodeMessage(4)).toBe("Código incorreto. Restam 4 tentativas.");
    expect(wrongReturnCodeMessage(1)).toBe("Código incorreto. Restam 1 tentativa.");
  });

  it("a 5ª tentativa errada bloqueia por 15 min e zera o contador", () => {
    let state = fresh;
    for (let n = 1; n < RETURN_CODE_MAX_ATTEMPTS; n++) {
      const r = attemptReturnCode(state, false, NOW);
      expect(r.outcome).toBe("wrong");
      state = r.next;
    }
    const last = attemptReturnCode(state, false, NOW);
    expect(last.outcome).toBe("locked");
    expect(last.next.failedAttempts).toBe(0);
    expect(last.next.lockedUntil).toBe(later(RETURN_CODE_LOCK_MS).toISOString());
    expect(returnCodeAttemptsLeft(last.next, NOW)).toBe(0);
  });

  it("durante o bloqueio nem o código certo vale; depois do prazo volta a valer", () => {
    const locked: ReturnCodeState = { ...fresh, lockedUntil: later(RETURN_CODE_LOCK_MS).toISOString() };
    expect(attemptReturnCode(locked, true, later(1000))).toMatchObject({ outcome: "blocked" });
    expect(attemptReturnCode(locked, true, later(1000)).next).toEqual(locked);
    expect(attemptReturnCode(locked, true, later(RETURN_CODE_LOCK_MS))).toMatchObject({ outcome: "verified" });
    expect(returnCodeAttemptsLeft(locked, later(RETURN_CODE_LOCK_MS))).toBe(RETURN_CODE_MAX_ATTEMPTS);
  });

  it("acerto zera erros e guarda o instante da conferência", () => {
    const r = attemptReturnCode({ ...fresh, failedAttempts: 3 }, true, NOW);
    expect(r.outcome).toBe("verified");
    expect(r.next).toMatchObject({ failedAttempts: 0, verifiedAt: NOW.toISOString(), usedAt: null });
  });

  it("mensagem de bloqueio arredonda os minutos para cima", () => {
    expect(returnCodeLockedMessage(RETURN_CODE_LOCK_MS)).toBe("Muitas tentativas incorretas. Aguarde 15 minutos para tentar de novo.");
    expect(returnCodeLockedMessage(60_000)).toBe("Muitas tentativas incorretas. Aguarde 1 minuto para tentar de novo.");
    expect(returnCodeLockedMessage(61_000)).toContain("2 minutos");
  });
});

describe("conferência para confirmar a entrega", () => {
  const verified: ReturnCodeState = { ...fresh, verifiedAt: NOW.toISOString() };

  it("válida por 15 minutos; uso único", () => {
    expect(returnCodeVerifiedUntil(verified)).toBe(later(RETURN_CODE_VERIFY_TTL_MS).toISOString());
    expect(isReturnCodeVerified(verified, later(RETURN_CODE_VERIFY_TTL_MS - 1))).toBe(true);
    expect(isReturnCodeVerified(verified, later(RETURN_CODE_VERIFY_TTL_MS))).toBe(false);
    expect(isReturnCodeVerified({ ...verified, usedAt: NOW.toISOString() }, later(1000))).toBe(false);
    expect(checkReturnCodeForDelivery(verified, later(1000))).toEqual({ allowed: true });
  });

  it("sem conferência, expirada ou já usada: INVALID_TRANSITION com a mensagem certa", () => {
    expect(checkReturnCodeForDelivery(undefined, NOW)).toEqual({
      allowed: false,
      code: "INVALID_TRANSITION",
      message: "Valide o código de retirada antes de confirmar a entrega.",
    });
    expect(checkReturnCodeForDelivery(fresh, NOW)).toMatchObject({ message: "Valide o código de retirada antes de confirmar a entrega." });
    expect(checkReturnCodeForDelivery({ ...verified, usedAt: NOW.toISOString() }, NOW)).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(checkReturnCodeForDelivery(verified, later(RETURN_CODE_VERIFY_TTL_MS))).toEqual({
      allowed: false,
      code: "INVALID_TRANSITION",
      message: "A conferência do código expirou. Valide o código novamente.",
    });
  });
});
