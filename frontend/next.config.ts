import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy. LIMITAÇÃO: `script-src` e `style-src` usam 'unsafe-inline' porque o Next injeta scripts
 * e estilos inline (hidratação, `next/font`) e uma política com nonce exigiria renderização dinâmica em todas as
 * rotas. Isso enfraquece a defesa contra XSS; as demais diretivas (origens fechadas, frame-ancestors, object-src)
 * continuam valendo. 'unsafe-eval' só em desenvolvimento (React/Turbopack).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://accounts.google.com https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://challenges.cloudflare.com",
  "frame-src https://accounts.google.com https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // HSTS só em produção (em desenvolvimento, http://localhost não deve ficar preso a HTTPS).
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /**
   * Modo API (`NEXT_PUBLIC_API_URL` definida): o navegador fala com `/backend/*` na mesma origem e o Next repassa ao
   * FastAPI em `API_INTERNAL_URL` (variável de SERVIDOR). Sem `NEXT_PUBLIC_API_URL` (mock) nada é reescrito.
   * Não usa `/api`, que pertence a `/api/auth/google` do modo mock.
   */
  async rewrites() {
    if (!process.env.NEXT_PUBLIC_API_URL) return [];
    const target = (process.env.API_INTERNAL_URL ?? "http://localhost:8000").replace(/\/+$/, "");
    return [{ source: "/backend/:path*", destination: `${target}/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
