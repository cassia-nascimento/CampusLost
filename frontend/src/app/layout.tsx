import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { AppProviders } from "@/providers/AppProviders";

export const metadata: Metadata = {
  title: { default: "CampusLost", template: "%s · CampusLost" },
  description: "Achados e perdidos do campus.",
  icons: { icon: "/brand/icon.svg" },
};

// Sem `maximumScale`: o zoom do usuário não pode ser bloqueado. `viewportFit: "cover"` habilita as áreas seguras.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F4EF",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a
          href="#conteudo"
          className="sr-only z-70 rounded-md bg-surface px-4 py-3 font-semibold text-primary shadow-raised focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Pular para o conteúdo
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
