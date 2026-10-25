/**
 * TOTP (RFC 6238) puro e síncrono: HMAC-SHA1, 30 s, 6 dígitos, janela de ±1 passo. Mesmo algoritmo do backend
 * (`backend/app/totp.py`). SHA-1 e HMAC são implementados aqui (RFC 3174 / RFC 2104) para a função ser síncrona,
 * sem Web Crypto e testável com os vetores do RFC. Sem relógio global nem aleatoriedade: o instante e os bytes
 * aleatórios vêm por parâmetro. Uso: mock do protótipo e testes; a API real faz isso no servidor.
 */

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Aceita o passo anterior e o seguinte (relógio do celular levemente fora). */
export const TOTP_WINDOW = 1;
export const TOTP_ISSUER = "CampusLost";
export const RECOVERY_CODE_COUNT = 8;

/* ---------- SHA-1 / HMAC-SHA1 ---------- */

function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

export function sha1(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  const paddedLength = (((message.length + 8) >> 6) + 1) << 6;
  const data = new Uint8Array(paddedLength);
  data.set(message);
  data[message.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + (f >>> 0) + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const outView = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => outView.setUint32(i * 4, h));
  return out;
}

export function hmacSha1(key: Uint8Array, message: Uint8Array): Uint8Array {
  const block = 64;
  const k = new Uint8Array(block);
  k.set(key.length > block ? sha1(key) : key);
  const inner = new Uint8Array(block + message.length);
  const outer = new Uint8Array(block + 20);
  for (let i = 0; i < block; i++) {
    inner[i] = k[i] ^ 0x36;
    outer[i] = k[i] ^ 0x5c;
  }
  inner.set(message, block);
  outer.set(sha1(inner), block);
  return sha1(outer);
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-1 em hexadecimal de um texto UTF-8 (usado só para guardar códigos de recuperação no mock). */
export function sha1Hex(text: string): string {
  return toHex(sha1(new TextEncoder().encode(text)));
}

/* ---------- Base32 (RFC 4648, sem padding) ---------- */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

/** `null` se houver caractere fora do alfabeto. Aceita minúsculas, espaços e `=`. */
export function base32Decode(text: string): Uint8Array | null {
  const clean = text.toUpperCase().replace(/[\s=]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/* ---------- HOTP / TOTP ---------- */

/** HOTP (RFC 4226) com a chave em bytes. `counter` é um inteiro seguro (até 2^53). */
export function hotp(key: Uint8Array, counter: number, digits: number = TOTP_DIGITS): string {
  const msg = new Uint8Array(8);
  const view = new DataView(msg.buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const digest = hmacSha1(key, msg);
  const offset = digest[19] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Passo de 30 s do instante. */
export function totpStep(now: Date, period: number = TOTP_PERIOD_SECONDS): number {
  return Math.floor(now.getTime() / 1000 / period);
}

/** Código TOTP do instante, com o segredo em base32. `null` se o segredo for inválido. */
export function totpCode(secret: string, now: Date, digits: number = TOTP_DIGITS): string | null {
  const key = base32Decode(secret);
  return key && key.length > 0 ? hotp(key, totpStep(now), digits) : null;
}

/**
 * Passo aceito (para guardar como `lastStep`) ou `null`. Janela de ±1 passo. Rejeita reuso: só passos
 * maiores que `lastStep` (anti-replay). Não depende de qual passo bateu para o tempo de execução.
 */
export function verifyTotp(secret: string, code: unknown, now: Date, lastStep?: number | null): number | null {
  if (typeof code !== "string") return null;
  const clean = code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const key = base32Decode(secret);
  if (!key || key.length === 0) return null;
  const current = totpStep(now);
  let found: number | null = null;
  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step++) {
    const match = hotp(key, step) === clean;
    if (match && found === null) found = step;
  }
  if (found === null || (lastStep != null && found <= lastStep)) return null;
  return found;
}

/** Segredo novo: 160 bits (20 bytes aleatórios fornecidos por quem chama) em base32, 32 caracteres. */
export function newTotpSecret(randomBytes: Uint8Array): string {
  return base32Encode(randomBytes.slice(0, 20));
}

export function otpauthUri(secret: string, account: string): string {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(TOTP_ISSUER)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}

/* ---------- Códigos de recuperação ---------- */

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** Códigos `xxxxx-xxxxx`. `randomBytes` precisa ter ao menos `count * 10` bytes. */
export function newRecoveryCodes(randomBytes: Uint8Array, count: number = RECOVERY_CODE_COUNT): string[] {
  const pick = (offset: number) =>
    Array.from({ length: 5 }, (_, i) => RECOVERY_ALPHABET[randomBytes[offset + i] % RECOVERY_ALPHABET.length]).join("");
  return Array.from({ length: count }, (_, n) => `${pick(n * 10)}-${pick(n * 10 + 5)}`);
}

/** `xxxxx-xxxxx` normalizado (minúsculas, hífen) ou `null` se o formato for inválido. */
export function normalizeRecoveryCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  let c = code.trim().toLowerCase().replace(/\s/g, "");
  if (c.length === 10 && !c.includes("-")) c = `${c.slice(0, 5)}-${c.slice(5)}`;
  return /^[a-z0-9]{5}-[a-z0-9]{5}$/.test(c) ? c : null;
}
