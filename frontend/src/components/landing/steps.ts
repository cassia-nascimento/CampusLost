/**
 * Os quatro passos do ciclo (DESIGN §9.13 e §10). Fonte única: a landing (`/`) e o painel de marca de
 * `/entrar` leem daqui, então título e descrição são sempre os mesmos nas duas telas.
 */
import { Camera, PackageCheck, Search, Tag, type LucideIcon } from "lucide-react";

export interface HowItWorksStep {
  title: string;
  text: string;
  icon: LucideIcon;
}

export const HOW_IT_WORKS_STEPS: readonly HowItWorksStep[] = [
  {
    title: "Registrar",
    text: "Achou algo? Cadastre o item com foto e o local onde o encontrou.",
    icon: Camera,
  },
  {
    title: "Buscar",
    text: "Veja os itens sem precisar de conta e filtre por categoria, local e data.",
    icon: Search,
  },
  {
    title: "Reivindicar",
    text: "Achou o seu? Entre na conta, diga que é seu e responda a duas perguntas.",
    icon: Tag,
  },
  {
    title: "Devolver",
    text: "A administração confere as respostas, aceita e registra a devolução.",
    icon: PackageCheck,
  },
];
