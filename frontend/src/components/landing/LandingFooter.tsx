import Link from "next/link";
import { Brand } from "@/components/layout/Brand";

const LINK = "link touch-target inline-flex items-center no-underline hover:underline";

const COLUMNS = [
  {
    label: "Plataforma",
    links: [
      { href: "/itens", text: "Ver itens" },
      { href: "/#como-funciona", text: "Como funciona" },
      { href: "/#perguntas", text: "Perguntas frequentes" },
    ],
  },
  {
    label: "Conta",
    links: [
      { href: "/entrar", text: "Entrar" },
      { href: "/cadastro", text: "Criar conta" },
    ],
  },
] as const;

/** Rodapé da landing (DESIGN §9.13): marca, duas colunas de navegação e direitos. Sem redes sociais nem política inventada. */
export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-6">
            <Brand href="/" />
            <p className="mt-2 max-w-sm text-body text-ink-muted">
              Achados e perdidos do campus: registre, busque, reivindique e acompanhe a devolução em um só lugar.
            </p>
          </div>
          {COLUMNS.map(({ label, links }) => (
            <nav key={label} aria-label={label} className="md:col-span-3">
              <p className="text-meta font-semibold text-ink">{label}</p>
              <ul role="list" className="mt-1 flex flex-col">
                {links.map(({ href, text }) => (
                  <li key={href}>
                    <Link href={href} className={LINK}>
                      {text}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="border-t border-line pt-6 text-meta text-ink-muted">© {new Date().getFullYear()} CampusLost</p>
      </div>
    </footer>
  );
}
