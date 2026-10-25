import { ListChecks, ShieldCheck, Layers, type LucideIcon } from "lucide-react";

interface Benefit {
  title: string;
  text: string;
  icon: LucideIcon;
}

const BENEFITS: readonly Benefit[] = [
  {
    title: "Tudo em um só lugar",
    text: "Os itens encontrados ficam reunidos em uma única lista, com descrição, local e data, e filtros por categoria, local e período.",
    icon: Layers,
  },
  {
    title: "Devolução com verificação",
    text: "Para reivindicar, a pessoa descreve o item e diz onde e quando o perdeu. A administração confere antes de aceitar. O local de guarda não é exibido a visitantes.",
    icon: ShieldCheck,
  },
  {
    title: "Cada etapa acompanhada",
    text: "Todo item tem um status claro (Disponível, Em reivindicação ou Devolvido) e quem reivindicou acompanha a resposta em Minhas reivindicações.",
    icon: ListChecks,
  },
];

/** "Por que usar" (DESIGN §9.13): três benefícios, todos já cobertos pelas regras da SPEC (sem números inventados). */
export function Benefits() {
  return (
    <section aria-labelledby="beneficios-titulo">
      <h2 id="beneficios-titulo">Achados e perdidos sem improviso</h2>
      <p className="mt-2 max-w-form text-lead font-normal text-ink-muted">
        Um fluxo único para registrar, buscar, reivindicar e devolver, com responsabilidades claras para cada perfil.
      </p>
      <ul role="list" className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        {BENEFITS.map(({ title, text, icon: Icon }) => (
          <li key={title} className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card">
            <span
              aria-hidden="true"
              className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"
            >
              <Icon className="size-6" />
            </span>
            <h3>{title}</h3>
            <p className="text-body text-ink-muted">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
