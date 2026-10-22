"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homePathFor } from "@/components/auth/home-path";
import { Brand } from "@/components/layout/Brand";
import { DemoBanner } from "@/components/layout/DemoNotice";
import { PublicShell } from "@/components/layout/PublicShell";
import { LinkButton } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useSession } from "@/hooks/use-session";
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

function Hero() {
  return (
    <section aria-labelledby="hero-titulo" className="animate-fade">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
        <div className="mx-auto w-full max-w-form lg:col-span-7 lg:max-w-none">
          <p className="text-meta font-semibold text-primary">Achados e perdidos do campus</p>
          <h1 id="hero-titulo" className="mt-2">
            Perdeu algo? Veja se já foi encontrado.
          </h1>
          <p className="mt-3 text-lead font-normal text-ink-muted">
            Veja os itens achados sem precisar entrar. Para reivindicar o seu, é só criar uma conta.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/itens" size="lg" width="mobile-full">
              Ver itens encontrados
              <ArrowRight aria-hidden="true" className="size-5 shrink-0" />
            </LinkButton>
            <LinkButton href="/entrar" variant="secondary" size="lg" width="mobile-full">
              Entrar
            </LinkButton>
          </div>
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
          <h2 id="chamada-final-titulo">Achou algo ou quer reivindicar o seu?</h2>
          <p className="mt-2 text-body text-ink">
            Crie sua conta para registrar itens e reivindicar o que é seu.
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
      <div className="mx-auto flex w-full max-w-page flex-col gap-12 px-gutter pt-8 pb-12 lg:gap-16 lg:pt-12 lg:pb-16">
        <Hero />
        <HowItWorks />
        <RecentItems />
        <FinalCall />
      </div>
    </PublicShell>
  );
}
