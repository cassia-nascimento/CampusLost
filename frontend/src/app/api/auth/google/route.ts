import { getAllowedGoogleDomains } from "@/lib/rules";
import { validateGoogleClaims } from "./claims";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKEN_LENGTH = 4096;
const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const FORBIDDEN_MESSAGE = "Use o e-mail institucional da UNDB.";

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Verifica o ID token do Google (P30) sem biblioteca: o `tokeninfo` do Google confere a assinatura e
 * nós conferimos as claims. Devolve só `{ email, name }`. O token nunca é registrado em log.
 * No protótipo esta rota existe no próprio Next; com o backend real, a verificação passa para o FastAPI.
 */
export async function POST(request: Request): Promise<Response> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return json({ error: "Login com Google indisponível." }, 503);

  let credential: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Requisição inválida." }, 400);
    credential = (JSON.parse(raw) as { credential?: unknown } | null)?.credential;
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }
  if (typeof credential !== "string" || credential === "" || credential.length > MAX_TOKEN_LENGTH) {
    return json({ error: "Requisição inválida." }, 400);
  }

  let claims: unknown;
  try {
    const response = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(credential)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return json({ error: "Não foi possível validar o login com Google." }, 401);
    claims = await response.json();
  } catch {
    return json({ error: "Não foi possível validar o login com Google." }, 401);
  }

  const result = validateGoogleClaims(claims, {
    clientId,
    allowedDomains: getAllowedGoogleDomains(),
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!result.ok) {
    return result.reason === "forbidden_domain"
      ? json({ error: FORBIDDEN_MESSAGE }, 403)
      : json({ error: "Não foi possível validar o login com Google." }, 401);
  }
  return json(result.profile, 200);
}
