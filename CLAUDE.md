# CampusLost — instruções para o Claude Code

Sistema acadêmico de achados e perdidos universitário (Mini-Projeto de Engenharia de Software, UNDB). Prazo do projeto: **27/10/2026**.

## Fase atual: protótipo de frontend SEM backend

Leia antes de agir (nesta ordem):
1. `docs/prototype/SPEC.md` — requisitos, regras, telas, critérios de aceite e premissas (fonte de verdade).
2. `docs/prototype/COORDENACAO.md` — papéis, donos de arquivos, formato de entrega, backlog.
3. `docs/prototype/DESIGN.md` — identidade visual e design system (existe após a Fase 3).

Não implemente FastAPI, SQLite, autenticação real ou infraestrutura. `backend/` fica intocado.

## Regras de honestidade sobre decisões

- Só a **stack** está formalmente decidida pela equipe. As regras de negócio vêm do documento de decisões como **[Recomendação] pendente**: use-as como premissas do protótipo, **nunca** as descreva como "aprovadas".
- Lacunas preenchidas por nós são **[Premissa]** e ficam registradas em `SPEC.md §9`. Não invente locais reais do campus nem dados definitivos; dados demonstrativos devem ser identificáveis como tais.
- Em conflito entre fontes: registre em `SPEC.md §9`, adote premissa provisória, siga em frente.

## Stack e comandos (rodar dentro de `frontend/`)

Next.js 16 (App Router) · React 19 · TypeScript estrito · Tailwind CSS 4 · npm (único gerenciador) · Node ≥ 20.9.

```
npm install        # dependências
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck  # tsc --noEmit
npm run test       # vitest (regras de domínio)
npm run build
```

Bibliotecas permitidas: react-hook-form, zod, @hookform/resolvers (série 5.x — a 6.x quebra a resolução de peers), lucide-react, clsx, tailwind-merge; dev: vitest. **Nova dependência exige pedido ao orquestrador** (só ele altera `package.json`).

**Fontes auto-hospedadas.** Não use `next/font/google`: o build falha sem acesso ao Google Fonts (sandbox e demonstração offline). Use `next/font/local` ou um pacote `@fontsource-variable/*` (peça a instalação ao orquestrador). O scaffold atual ainda usa Geist via Google e **precisa ser trocado** pelo `frontend-engineer` na T04 (o build só passa depois disso).

## Arquitetura do frontend

```
frontend/src/
  app/            rotas (App Router) — só composição de telas
  components/     ui/ (primitivos) · layout/ · items/ · claims/ · admin/
  hooks/          hooks de dados e de UI
  providers/      sessão e toasts
  services/       contracts.ts · index.ts · mock/ (seed, store, implementação)
  lib/            rules/ (máquina de estados, permissões — funções puras) · validation/ (zod) · utils
  types/          modelos de domínio
```

- UI nunca importa `services/mock/*`; usa `import { services } from "@/services"`. Trocar mocks por API REST = alterar `services/index.ts`.
- Regras de negócio vivem em `lib/rules` (puras e testadas), nunca espalhadas em componentes.
- Texto da interface em **português (pt-BR)**; identificadores de código em inglês; `<html lang="pt-BR">`.
- Mobile-first: tudo funciona a partir de **360 px** sem rolagem horizontal; alvos de toque ≥ 44 px.
- Reuse antes de criar: procure componente existente antes de escrever outro. Sem código duplicado, sem estilos hard-coded fora dos tokens do design system.
- Acessibilidade: `label` em todo campo, foco visível, teclado completo, contraste AA, diálogos acessíveis.

## Equipe de agentes (`.claude/agents/`)

O **contexto principal é o orquestrador** (sem agente próprio). Subagentes: `ux-designer`, `mock-engineer`, `frontend-engineer`, `qa-a11y`, `code-reviewer`. Papéis, donos de arquivo e protocolo estão em `docs/prototype/COORDENACAO.md`. Agent Teams (experimental) **não** é usado; o fluxo funciona com subagentes convencionais.

Regras que valem para todos:
- Edite **apenas** os arquivos que você possui; precisando de mudança em arquivo alheio, registre no relatório de entrega.
- Só o orquestrador faz `git commit`/`push`. Nunca publique, apague dados ou altere infraestrutura sem confirmação do usuário.
- Termine toda tarefa com o **relatório de entrega** (formato em `COORDENACAO.md`). Nunca afirme ter testado algo que não executou.

## Git

Branch de trabalho: `feature/prototipo-frontend`. Commits em Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`). PR segue `.github/pull_request_template.md`; `main` protegida na equipe (PR com uma aprovação).
