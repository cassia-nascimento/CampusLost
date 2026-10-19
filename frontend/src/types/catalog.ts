/**
 * DADOS DEMONSTRATIVOS (SPEC §3 / P5).
 *
 * Categorias e locais são listas fixas sem tela de edição. Os valores abaixo vêm
 * dos exemplos do documento de decisões e NÃO são os valores finais: a equipe
 * ainda definirá as listas reais. Este é o único módulo que as declara.
 */

export const DEMO_CATEGORIES = [
  "Eletrônicos",
  "Documentos",
  "Roupas",
  "Chaves",
  "Outros",
] as const;
export type DemoCategory = (typeof DEMO_CATEGORIES)[number];

export const DEMO_LOCATIONS = [
  "Bloco A",
  "Biblioteca",
  "Cantina",
  "Portaria",
] as const;
export type DemoLocation = (typeof DEMO_LOCATIONS)[number];

/** Texto para a interface deixar claro que as listas são provisórias. */
export const CATALOG_DEMO_NOTICE =
  "Categorias e locais de demonstração; os valores finais serão definidos pela equipe.";
