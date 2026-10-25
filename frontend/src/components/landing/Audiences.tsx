import { Check } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";

interface Audience {
  title: string;
  lead: string;
  points: readonly string[];
  cta: { href: string; label: string };
}

const AUDIENCES: readonly Audience[] = [
  {
    title: "Alunos e professores",
    lead: "Encontrou ou perdeu algo? Tudo é feito pela mesma conta.",
    points: [
      "Consultar os itens sem precisar de conta",
      "Registrar um item encontrado, com foto opcional",
      "Reivindicar o que é seu e responder à verificação",
      "Acompanhar cada reivindicação em Minhas reivindicações",
    ],
    cta: { href: "/cadastro", label: "Criar conta" },
  },
  {
    title: "Administração",
    lead: "Controle do que entra, do que é reivindicado e do que sai.",
    points: [
      "Analisar as reivindicações pendentes",
      "Aceitar ou recusar com base nas respostas",
      "Registrar a devolução do item",
      "Editar itens e consultar a lista de devoluções",
    ],
    cta: { href: "/entrar", label: "Entrar" },
  },
];

/** "Para quem é" (DESIGN §9.13): o que cada perfil faz, conforme a tabela de permissões da SPEC §2. */
export function Audiences() {
  return (
    <section aria-labelledby="perfis-titulo">
      <h2 id="perfis-titulo">Para cada perfil, o que importa</h2>
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {AUDIENCES.map(({ title, lead, points, cta }) => (
          <article key={title} className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card lg:p-6">
            <div>
              <h3>{title}</h3>
              <p className="mt-1 text-body text-ink-muted">{lead}</p>
            </div>
            <ul role="list" className="flex flex-col gap-2">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2 text-body">
                  <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success-fg" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            <LinkButton href={cta.href} variant="secondary" width="mobile-full" className="mt-auto self-start">
              {cta.label}
            </LinkButton>
          </article>
        ))}
      </div>
    </section>
  );
}
