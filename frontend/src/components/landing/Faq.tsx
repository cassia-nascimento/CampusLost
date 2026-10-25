import { ChevronDown } from "lucide-react";

interface FaqEntry {
  question: string;
  answer: string;
}

const FAQ: readonly FaqEntry[] = [
  {
    question: "Preciso de conta para ver os itens?",
    answer:
      "Não. A lista e o detalhe dos itens são abertos a qualquer pessoa. A conta é necessária para registrar um item encontrado ou para reivindicar o seu.",
  },
  {
    question: "Como o CampusLost confirma que o item é meu?",
    answer:
      "Ao reivindicar, você descreve o item com detalhes que comprovem a posse e diz onde e quando o perdeu. A administração confere as respostas e decide se aceita ou recusa.",
  },
  {
    question: "Quem pode registrar um item encontrado?",
    answer:
      "Alunos, professores e a administração, depois de entrar. Você informa título, descrição, categoria, local, data e onde o item está guardado; a foto é opcional.",
  },
  {
    question: "Posso entrar com minha conta Google?",
    answer:
      "Sim, desde que seja o e-mail institucional. Se for o seu primeiro acesso, basta escolher se você é aluno ou professor.",
  },
  {
    question: "O que acontece depois que a reivindicação é aceita?",
    answer:
      "A administração registra a devolução e o item deixa de aparecer na busca. Você acompanha cada mudança de status em Minhas reivindicações.",
  },
];

/**
 * Perguntas frequentes (DESIGN §9.13). `<details>` nativo: teclado e leitor de tela funcionam sem JavaScript.
 * O marcador padrão é escondido e substituído por um chevron que gira ao abrir.
 */
export function Faq() {
  return (
    <section id="perguntas" aria-labelledby="perguntas-titulo">
      <h2 id="perguntas-titulo">Perguntas frequentes</h2>
      <div className="mt-6 flex max-w-form flex-col gap-3">
        {FAQ.map(({ question, answer }) => (
          <details key={question} className="group rounded-lg bg-surface shadow-card">
            <summary className="touch-target flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg p-4 text-body font-semibold [&::-webkit-details-marker]:hidden">
              <span>{question}</span>
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="px-4 pb-4 text-body text-ink-muted">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
