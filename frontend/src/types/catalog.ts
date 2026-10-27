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

/** Categoria que é a opção "Outro": exige `categoryOther` (texto livre). Não é um valor novo, é "Outros". */
export const OTHER_CATEGORY: DemoCategory = "Outros";

/** `true` quando a categoria é a opção "Outro" (a UI mostra o campo "Especifique a categoria"). */
export function isOtherCategory(category: unknown): boolean {
  return category === OTHER_CATEGORY;
}

/**
 * Locais de EXEMPLO (sugestões de preenchimento e seed). O local do item é texto livre: esta lista NÃO valida
 * nem filtra nada.
 */
export const DEMO_LOCATIONS = [
  "Bloco A",
  "Biblioteca",
  "Cantina",
  "Portaria",
] as const;
export type DemoLocation = (typeof DEMO_LOCATIONS)[number];

/** Texto para a interface deixar claro que a lista de categorias é provisória (o local é texto livre). */
export const CATALOG_DEMO_NOTICE =
  "Categorias de demonstração; as categorias finais serão definidas pela equipe.";
