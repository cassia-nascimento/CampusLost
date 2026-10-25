import { Layers, ListChecks, ShieldCheck, type LucideIcon } from "lucide-react";

interface Benefit {
  title: string;
  text: string;
  icon: LucideIcon;
}

const BENEFITS: readonly Benefit[] = [
  {
    title: "Um só lugar",
    text: "Todos os itens encontrados no campus em uma única lista, com local e data, e filtros por categoria, local e período.",
    icon: Layers,
  },
  {
    title: "Devolução segura",
    text: "Quem reivindica descreve o item e conta onde e quando o perdeu. A administração confere antes de devolver, e o local de guarda não aparece para visitantes.",
    icon: ShieldCheck,
  },
  {
    title: "Sempre por dentro",
    text: "Cada item mostra se está Disponível, Em reivindicação ou Devolvido, e você acompanha as suas reivindicações em um só lugar.",
    icon: ListChecks,
  },
];

/** "Por que usar" (DESIGN §9.13): três benefícios, todos já cobertos pelas regras da SPEC (sem números inventados). */
export function Benefits() {
  return (
    <section aria-labelledby="beneficios-titulo">
      <h2 id="beneficios-titulo" className="max-w-form">
        Do item achado à devolução, sem perder o fio
      </h2>
      <ul role="list" className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
        {BENEFITS.map(({ title, text, icon: Icon }) => (
          <li key={title} className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-card">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"
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
