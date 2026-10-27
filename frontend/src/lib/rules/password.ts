/**
 * Política de senha (cadastro e redefinição) e medidor de força. Funções puras, sem I/O.
 * A mesma política vale no backend: mín. 10 caracteres, máx. 72 BYTES em UTF-8 (limite do bcrypt),
 * fora da lista de senhas comuns e diferente do e-mail e do nome.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;

/** Senhas comuns (comparadas em minúsculas). Lista curta de demonstração; o backend mantém a sua. */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  "1234567890", "12345678901", "123456789012", "0123456789", "1234512345", "0987654321", "9876543210",
  "1111111111", "0000000000", "2222222222", "1212121212", "1234554321", "12345678910", "123123123123",
  "qwertyuiop", "qwertyuiop123", "qwerty1234", "qwerty12345", "qwerty123456", "asdfghjkl1", "asdfghjkl123",
  "zxcvbnm123", "1q2w3e4r5t", "1q2w3e4r5t6y", "q1w2e3r4t5", "q1w2e3r4t5y6", "1qaz2wsx3edc", "qazwsxedc123",
  "password", "password1", "password12", "password123", "password1234", "password12345", "passw0rd123",
  "p@ssw0rd123", "p@ssword123", "pass123456", "pass1234567", "senha12345", "senha123456", "senha1234567",
  "senha@12345", "senha@123456", "minhasenha", "minhasenha1", "minhasenha123", "minhasenha12", "mudar12345",
  "mudar123456", "trocar12345", "trocar123456", "admin12345", "admin123456", "administrador", "administrador1",
  "administrador123", "welcome123", "welcome1234", "welcome12345", "letmein1234", "letmein12345", "iloveyou123",
  "iloveyou1234", "iloveyou12", "abc1234567", "abcd123456", "abcd1234567", "abcdefghij", "abcdefghijk",
  "abcdefg123", "abcdef1234", "abcdef12345", "123456abcd", "123456789a", "1234567890a", "123456789abc",
  "123456abc123", "brasil1234", "brasil12345", "brasil123456", "brasileiro", "flamengo123", "flamengo1234",
  "corinthians", "corinthians1", "palmeiras1", "palmeiras123", "saopaulo123", "gremio12345", "vasco123456",
  "fortaleza123", "fortaleza10", "maranhao123", "saoluis1234", "undb123456", "undb1234567", "campuslost",
  "campuslost1", "campuslost123", "campus12345", "estudante123", "estudante1234", "universidade", "universidade1",
  "mudarsenha", "mudarsenha1", "amorzinho12", "amor123456", "te@mo123456", "meuamor123", "princesa123",
  "football123", "monkey1234", "dragon12345", "master12345", "superman123", "batman12345", "sunshine123",
  "starwars123", "pokemon1234", "naruto12345", "demo1234567", "demo12345678", "teste12345", "teste123456",
  "teste1234567", "testando123", "test123456", "test1234567", "senhasenha", "senhasegura", "senhasegura1",
]);

/** Tamanho da senha em bytes UTF-8 (o limite de 72 é em bytes, não em caracteres). */
export function passwordByteLength(password: string): number {
  return new TextEncoder().encode(password).length;
}

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}

/** Letras e dígitos minúsculos sem acento, para comparar a senha com e-mail/nome. */
function squash(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Motivos pelos quais uma senha de cadastro/redefinição é recusada (primeiro encontrado), ou `null` se aceita.
 * `email` e `name` são opcionais; a senha não pode ser igual a eles (ignorando caixa, acentos e pontuação).
 */
export type PasswordIssue = "too_short" | "too_long" | "common" | "same_as_email" | "same_as_name";

export function passwordIssue(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordIssue | null {
  if ([...password].length < PASSWORD_MIN_LENGTH) return "too_short";
  if (passwordByteLength(password) > PASSWORD_MAX_BYTES) return "too_long";
  if (isCommonPassword(password)) return "common";
  const flat = squash(password);
  const email = context.email?.trim().toLowerCase();
  if (email && (password.trim().toLowerCase() === email || (flat && flat === squash(email)))) return "same_as_email";
  const name = context.name ? squash(context.name) : "";
  if (name && flat === name) return "same_as_name";
  return null;
}

export const PASSWORD_ISSUE_MESSAGE: Readonly<Record<PasswordIssue, string>> = {
  too_short: `Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  too_long: "A senha é longa demais. Use uma senha mais curta.",
  common: "Essa senha é muito comum. Escolha outra.",
  same_as_email: "A senha não pode ser igual ao seu e-mail.",
  same_as_name: "A senha não pode ser igual ao seu nome.",
};

/**
 * Força da senha de 0 (muito fraca) a 4 (forte). Só orienta a pessoa; a aceitação é `passwordIssue`.
 * Senha recusada pela política (curta, comum) nunca passa de 1.
 */
export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): PasswordStrength {
  if (!password) return 0;
  const length = [...password].length;
  if (isCommonPassword(password)) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  const distinct = new Set(password).size;
  let score = 0;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (length >= 16) score += 1;
  if (classes >= 3) score += 1;
  // Pouca variedade (ex.: "aaaaaaaaaaaa") derruba a nota.
  if (distinct <= 3) score = Math.min(score, 1);
  else if (distinct < length / 2) score = Math.min(score, 2);
  if (classes === 1) score = Math.min(score, 2);
  if (length < PASSWORD_MIN_LENGTH) score = Math.min(score, 1);
  return Math.max(0, Math.min(4, score)) as PasswordStrength;
}

export const PASSWORD_STRENGTH_LABEL: Readonly<Record<PasswordStrength, string>> = {
  0: "Muito fraca",
  1: "Fraca",
  2: "Razoável",
  3: "Boa",
  4: "Forte",
};
