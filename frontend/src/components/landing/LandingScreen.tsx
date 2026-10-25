"use client";

import { ArrowRight, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homePathFor } from "@/components/auth/home-path";
import { Brand } from "@/components/layout/Brand";
import { DemoBanner } from "@/components/layout/DemoNotice";
import { PublicShell } from "@/components/layout/PublicShell";
import { LinkButton } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useSession } from "@/hooks/use-session";
import { Audiences } from "./Audiences";
import { Benefits } from "./Benefits";
import { Faq } from "./Faq";
import { HowItWorks } from "./HowItWorks";
import { LandingFooter } from "./LandingFooter";
import { RecentItems } from "./RecentItems";

/** Só a marca e um indicador de carregamento: quem tem sessão é redirecionado sem ver a landing piscar. */
function LandingLoading() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-(--header-h) max-w-page items-center px-gutter">
          <Brand href="/" />
        </div>
      </header>
      <main id="conteudo" tabIndex={-1} className="flex flex-1 items-center justify-center outline-none">
        <Spinner className="size-8 text-primary" />
        <p role="status" className="sr-only">
          Carregando…
        </p>
      </main>
    </div>
  );
}

/** Garantias reais do produto (SPEC §2, AC03.1, AC07), em uma linha curta sob os botões. */
const HERO_ASSURANCES = [
  "Consulta aberta, sem cadastro",
  "Reivindicação conferida pela administração",
  "Feito para usar no celular",
] as const;

/** Faixa de largura total sobre `primary-soft`: o fundo do `hero.svg` é a mesma cor, então a ilustração se funde à faixa. */
function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="animate-fade bg-primary-soft">
      <div className="mx-auto grid w-full max-w-page grid-cols-1 gap-8 px-gutter py-10 lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-16">
        <div className="mx-auto w-full max-w-form lg:col-span-7 lg:max-w-none">
          <p className="text-meta font-semibold text-primary">Achados e perdidos do campus</p>
          <h1 id="hero-titulo" className="mt-2">
            Recupere o que você perdeu no campus.
          </h1>
          <p className="mt-3 max-w-form text-lead font-normal text-ink-muted">
            Consulte os itens encontrados sem criar conta. Ao achar o seu, faça a reivindicação: a administração
            confere e cuida da devolução.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/itens" size="lg" width="mobile-full">
              Buscar itens encontrados
              <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
            </LinkButton>
            <LinkButton href="/entrar" variant="secondary" size="lg" width="mobile-full">
              Entrar
            </LinkButton>
          </div>
          <ul role="list" className="mt-6 flex flex-col gap-2 text-meta text-ink sm:flex-row sm:flex-wrap sm:gap-x-5">
            {HERO_ASSURANCES.map((text) => (
              <li key={text} className="flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-4 shrink-0 text-success-fg" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-form lg:col-span-5 lg:max-w-none">
          {/* Decorativa (alt vazio): a mensagem está toda no texto ao lado. `<img>` simples, é um SVG. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hero.svg" alt="" width={400} height={300} className="aspect-[4/3] w-full rounded-lg" />
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section aria-labelledby="chamada-final-titulo">
      <div className="flex flex-col gap-6 rounded-xl bg-primary-soft p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:p-8">
        <div className="max-w-xl">
          <h2 id="chamada-final-titulo">Comece agora</h2>
          <p className="mt-2 text-body text-ink">
            Crie sua conta para registrar itens encontrados e reivindicar o que é seu. Consultar a lista continua
            sem cadastro.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <LinkButton href="/cadastro" size="lg" width="mobile-full">
            Criar conta
          </LinkButton>
          <LinkButton href="/entrar" variant="secondary" size="lg" width="mobile-full">
            Entrar
          </LinkButton>
        </div>
      </div>
    </section>
  );
}

/**
 * `/` (DESIGN §9.13, P26): landing pública. Quem tem sessão vai para a página inicial do perfil (SPEC §5);
 * enquanto a sessão carrega ou o redirecionamento acontece, só aparece `LandingLoading`.
 */
export function LandingScreen() {
  const { user, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "ready" && user) router.replace(homePathFor(user.role));
  }, [status, user, router]);

  if (status !== "ready" || user) return <LandingLoading />;

  return (
    <PublicShell pathname="/" footer={<LandingFooter />}>
      <Hero />
      <div className="mx-auto flex w-full max-w-page flex-col gap-12 px-gutter pt-12 pb-12 lg:gap-16 lg:pt-16 lg:pb-16">
        <Benefits />
        <HowItWorks />
        <RecentItems />
        <Audiences />
        <Faq />
        <FinalCall />
      </div>
    </PublicShell>
  );
}
