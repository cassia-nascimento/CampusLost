import { HOW_IT_WORKS_STEPS } from "./steps";

/**
 * "Como funciona" (DESIGN §9.13): os quatro passos em lista ordenada, sobre a faixa `primary` (texto `on-primary`,
 * cartões `surface`). Nada aqui é clicável, então não há foco sobre fundo escuro. O número visível é decorativo.
 */
export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-titulo">
      <h2 id="como-funciona-titulo" className="text-on-primary">
        Como funciona
      </h2>
      <p className="mt-2 max-w-form text-lead font-normal text-on-primary">
        Do registro à devolução, em quatro etapas.
      </p>
      {/* `role="list"`: o reset de listas do Tailwind faz o Safari/VoiceOver deixar de anunciar a lista. */}
      <ol role="list" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {HOW_IT_WORKS_STEPS.map(({ title, text, icon: Icon }, index) => (
          <li key={title} className="reveal flex flex-col gap-3 rounded-lg bg-surface p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-display font-bold text-on-primary tabular"
              >
                {index + 1}
              </span>
              <Icon aria-hidden="true" className="size-6 text-primary" />
            </div>
            <h3>{title}</h3>
            <p className="text-body text-ink-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
