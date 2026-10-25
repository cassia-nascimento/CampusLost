import { ChevronDown } from "lucide-react";

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ: readonly FaqEntry[] = [
  {
    question: "Preciso de conta para ver os itens?",
    answer:
      "Não. A lista e o detalhe dos itens são abertos a qualquer pessoa. A conta só é necessária para registrar um item encontrado ou reivindicar o seu.",
  },
  {
    question: "Como o CampusLost confirma que o item é meu?",
    answer:
      "Ao reivindicar, você descreve o item com detalhes que só o dono saberia e conta onde e quando o perdeu. A administração compara com o item guardado e decide se aceita ou recusa.",
  },
  {
    question: "Quem pode registrar um item encontrado?",
    answer:
      "Qualquer pessoa com conta. Você informa título, descrição, categoria, local, data e onde o item está guardado; a foto é opcional.",
  },
  {
    question: "Posso entrar com a minha conta Google?",
    answer:
      "Sim, com o e-mail institucional. No primeiro acesso, basta escolher se você é aluno ou professor.",
  },
  {
    question: "O que acontece depois que a reivindicação é aceita?",
    answer:
      "A administração registra a devolução e o item sai da busca. Você acompanha cada mudança em Minhas reivindicações.",
  },
];

/**
 * Perguntas frequentes (DESIGN §9.13): título à esquerda e lista à direita em `lg`, empilhados abaixo disso.
 * `<details>` nativo: teclado e leitor de tela funcionam sem JavaScript. O marcador padrão é escondido e
 * substituído por um chevron que gira ao abrir.
 */
export function Faq() {
  return (
    <section id="perguntas" aria-labelledby="perguntas-titulo">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <h2 id="perguntas-titulo">Perguntas frequentes</h2>
          <p className="mt-2 text-lead font-normal text-ink-muted">O essencial antes de começar.</p>
        </div>
        <div className="reveal flex flex-col gap-3 lg:col-span-8">
          {FAQ.map(({ question, answer }) => (
            <details key={question} className="group rounded-lg border border-line bg-paper transition-colors open:bg-surface open:shadow-card">
              <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-4 text-body font-semibold transition-colors hover:bg-primary-soft [&::-webkit-details-marker]:hidden">
                <span>{question}</span>
                <ChevronDown
                  aria-hidden="true"
                  className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="px-4 pb-4 text-body text-ink-muted group-open:animate-fade">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
