"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homePathFor } from "@/components/auth/home-path";
import { Brand } from "@/components/layout/Brand";
import { DemoBanner } from "@/components/layout/DemoNotice";
import { PublicShell } from "@/components/layout/PublicShell";
import { LinkButton } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { ItemStatusBadge } from "@/components/ui/StatusBadge";
import { useSession } from "@/hooks/use-session";
import { Band } from "./Band";
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

/**
 * Prévia do produto: a ilustração da marca em um cartão, com os três status que todo item percorre. Os selos são os
 * componentes reais (`ItemStatusBadge`), então o vocabulário é o mesmo da busca. Decorativa: o texto ao lado diz tudo.
 */
function HeroPreview() {
  return (
    <div aria-hidden="true" className="animate-rise relative mx-auto w-full max-w-form lg:max-w-none">
      <div className="rounded-xl bg-surface p-3 shadow-raised">
        {/* `<img>` simples, é um SVG. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/hero.svg" alt="" width={400} height={300} className="aspect-[4/3] w-full rounded-lg" />
      </div>
      <ItemStatusBadge status="available" className="animate-float absolute top-6 left-6 shadow-card" />
      <ItemStatusBadge status="under_claim" className="animate-float absolute top-[22%] right-6 shadow-card [animation-delay:-2s]" />
      <ItemStatusBadge status="returned" className="animate-float absolute bottom-6 left-6 shadow-card [animation-delay:-4s]" />
    </div>
  );
}

/** Faixa de largura total sobre `primary-soft`; é o único trecho que não usa `Band` porque tem estrutura própria. */
function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="animate-fade bg-primary-soft">
      <div className="mx-auto grid w-full max-w-page grid-cols-1 gap-10 px-gutter py-12 lg:grid-cols-12 lg:items-center lg:gap-12 lg:py-20">
        <div className="mx-auto w-full max-w-form lg:col-span-7 lg:max-w-none">
          <p className="text-meta font-semibold text-primary">Achados e perdidos do campus</p>
          <h1 id="hero-titulo" className="mt-2 lg:text-display">
            Recupere o que você perdeu no campus.
          </h1>
          <p className="mt-4 max-w-form text-lead font-normal text-ink-muted">
            Os objetos encontrados no campus ficam reunidos aqui. Localize o seu, comprove que é seu e receba de volta
            com segurança.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/itens" size="lg" width="mobile-full">
              Procurar meu item
              <ArrowRight
                aria-hidden="true"
                className="size-5 shrink-0 transition-transform duration-150 ease-standard motion-safe:group-hover/btn:translate-x-1"
              />
            </LinkButton>
            <LinkButton href="/entrar" variant="secondary" size="lg" width="mobile-full">
              Entrar
            </LinkButton>
          </div>
          <p className="mt-8 flex max-w-form items-start gap-2 text-meta text-ink">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            Cada devolução é conferida e registrada pela administração do campus.
          </p>
        </div>
        <div className="lg:col-span-5">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section aria-labelledby="chamada-final-titulo">
      <div className="reveal flex flex-col gap-6 rounded-xl bg-primary-soft p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:p-10">
        <div className="max-w-xl">
          <h2 id="chamada-final-titulo">Achou algo ou perdeu algo?</h2>
          <p className="mt-2 text-body text-ink">
            Crie sua conta para registrar o que encontrou ou reivindicar o que é seu.
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
      <Band>
        <Benefits />
      </Band>
      <Band tone="primary">
        <HowItWorks />
      </Band>
      <Band>
        <RecentItems />
      </Band>
      <Band tone="surface">
        <Faq />
      </Band>
      <Band>
        <FinalCall />
      </Band>
    </PublicShell>
  );
}
