import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { DemoBanner } from "@/components/layout/DemoNotice";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Página não encontrada" };

/**
 * 404 de qualquer rota inexistente (D5). Renderiza dentro do layout raiz (idioma e fontes), mas fora dos
 * grupos `(app)`/`(public)`, então monta a própria estrutura: aviso de demonstração, `main` e rodapé.
 * O destino do botão é `/`, que leva cada perfil à sua página inicial (ou a `/entrar` sem sessão).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        <Container size="form" className="justify-center">
          <EmptyState
            variant="no-results"
            headingLevel={1}
            title="Página não encontrada"
            action={<LinkButton href="/">Voltar ao início</LinkButton>}
          >
            O endereço que você abriu não existe ou foi alterado. Volte ao início para continuar.
          </EmptyState>
        </Container>
      </main>
    </div>
  );
}
