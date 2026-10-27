/**
 * Código de retirada (RF05, AC05.5–05.11): só o PROPRIETÁRIO confirmado (solicitante da reivindicação aceita) o gera,
 * na própria conta; a administração o digita, o sistema valida, e só depois a entrega é confirmada (validar ≠ devolver).
 * Funções puras: o mock e (por paridade) o backend aplicam estas regras; a UI não as reimplementa.
 */
import type { Claim, Item, User } from "@/types/domain";
import { ALLOW, deny, type Decision } from "./decision";
import { hasCapability } from "./permissions";

/** 30 símbolos sem os ambíguos (0/O, 1/I/L, U). */
export const RETURN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const RETURN_CODE_LENGTH = 8;
/** Tentativas erradas até o bloqueio. */
export const RETURN_CODE_MAX_ATTEMPTS = 5;
export const RETURN_CODE_LOCK_MS = 15 * 60_000;
/** Quanto tempo uma conferência correta vale para confirmar a entrega (uso único). */
export const RETURN_CODE_VERIFY_TTL_MS = 15 * 60_000;

export const RETURN_CODE_NOT_ELIGIBLE_MESSAGE =
  "Só reivindicações aceitas, de itens aguardando devolução, têm código de retirada.";
export const RETURN_CODE_NOT_ISSUED_MESSAGE =
  "A pessoa ainda não gerou o código de retirada. Peça para ela gerar em Minhas reivindicações.";
export const RETURN_CODE_REQUIRED_MESSAGE = "Informe o código de retirada.";
export const RETURN_CODE_NOT_VERIFIED_MESSAGE = "Valide o código de retirada antes de confirmar a entrega.";
export const RETURN_CODE_EXPIRED_MESSAGE = "A conferência do código expirou. Valide o código novamente.";

/** "1 tentativa" / "4 tentativas". */
function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function wrongReturnCodeMessage(attemptsLeft: number): string {
  return `Código incorreto. Restam ${plural(attemptsLeft, "tentativa", "tentativas")}.`;
}

export function returnCodeLockedMessage(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `Muitas tentativas incorretas. Aguarde ${plural(minutes, "minuto", "minutos")} para tentar de novo.`;
}

/* ---------- Formato ---------- */

/**
 * Sorteia o código a partir de bytes aleatórios. Rejeita bytes ≥ 240 (maior múltiplo de 30 abaixo de 256) para
 * que cada símbolo tenha a mesma probabilidade (sem viés de módulo).
 */
export function generateReturnCode(randomBytes: (length: number) => Uint8Array): string {
  const limit = 256 - (256 % RETURN_CODE_ALPHABET.length);
  let code = "";
  while (code.length < RETURN_CODE_LENGTH) {
    for (const byte of randomBytes(RETURN_CODE_LENGTH * 2)) {
      if (byte >= limit) continue;
      code += RETURN_CODE_ALPHABET[byte % RETURN_CODE_ALPHABET.length];
      if (code.length === RETURN_CODE_LENGTH) break;
    }
  }
  return code;
}

/** `K7M29QXB` → `K7M2-9QXB` (exibição). */
export function formatReturnCode(code: string): string {
  const half = RETURN_CODE_LENGTH / 2;
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** Entrada digitada → forma canônica: maiúsculas, sem espaços e sem hífens. */
export function normalizeReturnCode(input: string): string {
  return input.replace(/[\s\-‐-―]/g, "").toLocaleUpperCase("en-US");
}

/** A forma canônica tem o tamanho e o alfabeto certos? */
export function isWellFormedReturnCode(normalized: string): boolean {
  return (
    normalized.length === RETURN_CODE_LENGTH && [...normalized].every((char) => RETURN_CODE_ALPHABET.includes(char))
  );
}

/* ---------- Quem pode o quê ---------- */

type ClaimLike = Pick<Claim, "claimantId" | "status">;
type ItemLike = Pick<Item, "status">;

/**
 * Gerar o código: só o autor da reivindicação, com reivindicação aceita e item ainda aguardando devolução
 * (Em reivindicação).
 */
export function canIssueReturnCode(actor: User | null | undefined, item: ItemLike, claim: ClaimLike): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (claim.claimantId !== actor.id) {
    return deny("FORBIDDEN", "Somente quem fez a reivindicação pode gerar o código de retirada.");
  }
  if (claim.status !== "accepted" || item.status !== "under_claim") {
    return deny("INVALID_TRANSITION", RETURN_CODE_NOT_ELIGIBLE_MESSAGE);
  }
  return ALLOW;
}

/** Conferir o código (e depois confirmar a entrega): administração, reivindicação aceita, item Em reivindicação. */
export function canVerifyReturnCode(actor: User | null | undefined, item: ItemLike, claim: ClaimLike): Decision {
  if (actor == null) return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.");
  if (!hasCapability(actor, "register_return")) {
    return deny("FORBIDDEN", "Somente a administração pode conferir o código de retirada.");
  }
  if (item.status === "returned") return deny("ITEM_RETURNED", "Este item já foi devolvido.");
  if (claim.status !== "accepted" || item.status !== "under_claim") {
    return deny("INVALID_TRANSITION", RETURN_CODE_NOT_ELIGIBLE_MESSAGE);
  }
  return ALLOW;
}

/* ---------- Tentativas, bloqueio e conferência ---------- */

/** Parte do registro do código que as regras de tentativa e de conferência usam. */
export interface ReturnCodeState {
  failedAttempts: number;
  /** Instante ISO; `null` sem bloqueio. */
  lockedUntil: string | null;
  verifiedAt: string | null;
  usedAt: string | null;
}

export function returnCodeLockRemainingMs(state: Pick<ReturnCodeState, "lockedUntil">, now: Date): number {
  if (!state.lockedUntil) return 0;
  return Math.max(0, new Date(state.lockedUntil).getTime() - now.getTime());
}

/** Tentativas que restam (0 enquanto bloqueado). */
export function returnCodeAttemptsLeft(state: ReturnCodeState, now: Date): number {
  if (returnCodeLockRemainingMs(state, now) > 0) return 0;
  return Math.max(0, RETURN_CODE_MAX_ATTEMPTS - state.failedAttempts);
}

/** Instante até o qual a conferência vale, ou `null` se não há conferência. */
export function returnCodeVerifiedUntil(state: Pick<ReturnCodeState, "verifiedAt">): string | null {
  if (!state.verifiedAt) return null;
  return new Date(new Date(state.verifiedAt).getTime() + RETURN_CODE_VERIFY_TTL_MS).toISOString();
}

/** Conferência válida agora: feita, ainda dentro do prazo e não usada. */
export function isReturnCodeVerified(state: ReturnCodeState, now: Date): boolean {
  const until = returnCodeVerifiedUntil(state);
  return until !== null && state.usedAt === null && now.getTime() < new Date(until).getTime();
}

/** Pode confirmar a entrega? Senão, o motivo (não conferido / conferência expirada). */
export function checkReturnCodeForDelivery(state: ReturnCodeState | undefined, now: Date): Decision {
  if (!state || state.verifiedAt === null || state.usedAt !== null) {
    return deny("INVALID_TRANSITION", RETURN_CODE_NOT_VERIFIED_MESSAGE);
  }
  if (!isReturnCodeVerified(state, now)) return deny("INVALID_TRANSITION", RETURN_CODE_EXPIRED_MESSAGE);
  return ALLOW;
}

export type ReturnCodeAttempt =
  /** Bloqueado: a tentativa nem é comparada (nem o código certo vale). */
  | { outcome: "blocked"; next: ReturnCodeState; remainingMs: number }
  | { outcome: "verified"; next: ReturnCodeState }
  | { outcome: "wrong"; next: ReturnCodeState; attemptsLeft: number }
  /** A tentativa errada que esgotou o limite: o bloqueio começa agora e o contador zera. */
  | { outcome: "locked"; next: ReturnCodeState; remainingMs: number };

/** Uma tentativa de conferência. `match`: o hash do código digitado confere com o guardado? */
export function attemptReturnCode(state: ReturnCodeState, match: boolean, now: Date): ReturnCodeAttempt {
  const remainingMs = returnCodeLockRemainingMs(state, now);
  if (remainingMs > 0) return { outcome: "blocked", next: state, remainingMs };
  // Bloqueio vencido: começa limpo.
  const base: ReturnCodeState = { ...state, lockedUntil: null };
  if (match) {
    return { outcome: "verified", next: { ...base, failedAttempts: 0, verifiedAt: now.toISOString() } };
  }
  const failedAttempts = base.failedAttempts + 1;
  if (failedAttempts >= RETURN_CODE_MAX_ATTEMPTS) {
    return {
      outcome: "locked",
      next: { ...base, failedAttempts: 0, lockedUntil: new Date(now.getTime() + RETURN_CODE_LOCK_MS).toISOString() },
      remainingMs: RETURN_CODE_LOCK_MS,
    };
  }
  return {
    outcome: "wrong",
    next: { ...base, failedAttempts },
    attemptsLeft: RETURN_CODE_MAX_ATTEMPTS - failedAttempts,
  };
}
