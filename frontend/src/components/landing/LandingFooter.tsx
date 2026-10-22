import Link from "next/link";

const LINK = "link touch-target inline-flex items-center";

/** Rodapé simples da landing (DESIGN §9.13): sem redes sociais nem política inventada. */
export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-page flex-col gap-2 px-gutter py-8 text-meta text-ink-muted">
        <p>
          <span className="font-semibold text-ink">CampusLost</span> · Achados e perdidos do campus
        </p>
        <nav aria-label="Rodapé">
          <ul role="list" className="flex flex-wrap gap-x-5">
            <li>
              <Link href="/itens" className={LINK}>
                Ver itens
              </Link>
            </li>
            <li>
              <Link href="/entrar" className={LINK}>
                Entrar
              </Link>
            </li>
            <li>
              <Link href="/cadastro" className={LINK}>
                Criar conta
              </Link>
            </li>
          </ul>
        </nav>
        <p>Projeto acadêmico · UNDB</p>
      </div>
    </footer>
  );
}
