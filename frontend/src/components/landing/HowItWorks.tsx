import { HOW_IT_WORKS_STEPS } from "./steps";

/** "Como funciona" (DESIGN §9.13): os quatro passos em lista ordenada; o número visível é decorativo. */
export function HowItWorks() {
  return (
    <section aria-labelledby="como-funciona-titulo">
      <h2 id="como-funciona-titulo">Como funciona</h2>
      {/* `role="list"`: o reset de listas do Tailwind faz o Safari/VoiceOver deixar de anunciar a lista. */}
      <ol role="list" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {HOW_IT_WORKS_STEPS.map(({ title, text, icon: Icon }, index) => (
          <li key={title} className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-display font-bold text-on-primary tabular"
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
