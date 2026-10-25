/**
 * Hash de senha do mock (P29): PBKDF2-SHA-256 com sal por usuário, via Web Crypto (navegador e Node).
 * É só para o protótipo NÃO guardar senha em texto puro; não é segurança real (o banco é o
 * `localStorage` do próprio navegador).
 */
export const PBKDF2_ITERATIONS = 100_000;
const KEY_BITS = 256;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** Token opaco aleatório (32 hex) para links de verificação/redefinição simulados. */
export function newToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPassword(
  password: string,
  saltHex: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations },
    key,
    KEY_BITS,
  );
  return toHex(new Uint8Array(bits));
}

/** Comparação sem saída antecipada. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DUMMY_SALT = "00".repeat(16);

/**
 * Confere a senha da conta no registro de credenciais. Sempre calcula um hash (mesmo sem conta ou sem senha)
 * para não distinguir os casos pelo tempo. `false` para conta sem senha (só Google).
 */
export async function verifyAccountPassword(
  credentials: readonly { userId: string; provider: string; salt?: string; hash?: string; iterations?: number }[],
  userId: string | undefined,
  password: string,
): Promise<boolean> {
  const cred = userId ? credentials.find((c) => c.userId === userId && c.provider === "password") : undefined;
  const computed = await hashPassword(password, cred?.salt ?? DUMMY_SALT, cred?.iterations ?? PBKDF2_ITERATIONS);
  return !!cred?.hash && safeEqual(computed, cred.hash);
}
