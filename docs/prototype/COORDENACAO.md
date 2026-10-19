# Coordenação da equipe de agentes — protótipo CampusLost

## 1. Arquitetura escolhida (e por quê)

**Orquestrador = contexto principal do Claude Code** (sem agente próprio) + **5 subagentes convencionais** com donos de arquivo disjuntos.

| Agente | Papel | Edita | Ferramentas |
|---|---|---|---|
| *Orquestrador* (contexto principal) | Requisitos, priorização, delegação, integração, commits, aceite. Absorve o "Product & Requirements Analyst": o trabalho de traduzir RFs em telas/critérios é pontual e já está em `SPEC.md`; um agente permanente só duplicaria contexto. | `CLAUDE.md`, `.claude/**`, `docs/prototype/*.md` (exceto `DESIGN.md`), configs da raiz, `frontend/package.json` | todas |
| `ux-designer` | Identidade visual e design system | `docs/prototype/DESIGN.md`, `frontend/src/app/globals.css`, `frontend/public/brand/**` | leitura + escrita de arquivos (sem Bash) |
| `mock-engineer` | Tipos, regras puras, schemas, serviços mock, testes de domínio | `frontend/src/{types,lib/rules,lib/validation,services}/**`, `vitest.config.ts` | arquivos + Bash |
| `frontend-engineer` | Telas, componentes, hooks, providers | `frontend/src/{app,components,hooks,providers}/**`, `lib/utils.ts`, `lib/format.ts` | todas |
| `qa-a11y` | Testes funcionais, 360 px, acessibilidade, evidências | `docs/prototype/qa/**` | todas (inclui navegador, se disponível) |
| `code-reviewer` | Revisão independente, somente leitura | nada | Read/Glob/Grep/Bash |

**Cortes em relação à proposta inicial:** (a) Product Analyst fundido ao orquestrador; (b) Designer e Frontend mantidos separados porque a revisão cruzada de consistência visual é o maior risco de "cara de template"; (c) Mock Engineer mantido separado porque a máquina de estados é onde estão os bugs de regra e precisa de testes próprios; (d) Reviewer ≠ implementador por construção.

**Agent Teams (experimental): não usado.** As tarefas têm dependências lineares fortes (tipos → serviços → telas) e a comunicação entre agentes passa pelo orquestrador e pelos relatórios; o custo e o risco de um recurso experimental não compensam. Se for ligado no futuro, o fluxo continua válido.

## 2. Ciclo de trabalho

1. Orquestrador escolhe a próxima tarefa do backlog (§5) e verifica dependências.
2. Delega ao agente dono com: objetivo, arquivos que pode editar, trechos relevantes da SPEC, critérios AC e formato de entrega.
3. Agente executa e devolve o **relatório de entrega**.
4. Orquestrador **verifica por conta própria** (git diff, lint/typecheck/test/build) — não aceita "pronto" sem evidência.
5. `code-reviewer` (e `qa-a11y` nas ondas de tela) avaliam; defeitos viram tarefas de correção para o dono.
6. Corrigido → revalidado → orquestrador faz commit (Conventional Commits) e abre a próxima tarefa.
7. Atualiza `docs/prototype/PROGRESSO.md` ao fim de cada onda.

**Paralelismo permitido** somente com donos e pastas disjuntos (ex.: `ux-designer` ‖ `mock-engineer`; duas instâncias de `frontend-engineer` em rotas distintas, depois que `components/ui` estiver estável). Conflito de arquivo → execução sequencial.

## 3. Formato do relatório de entrega

```
Arquivos alterados:
O que foi implementado:
O que foi testado (comandos reais e resultados; o que NÃO foi possível testar):
Problemas encontrados:
Pendências / pedidos a outros donos:
```

## 4. Definição de pronto (por tarefa e do protótipo)

Por tarefa: critérios AC da tarefa atendidos · lint, typecheck e build sem erro · sem import de `services/mock/*` na UI · sem cores/espaçamentos fora dos tokens · estados loading/vazio/erro/sucesso presentes · 360 px sem rolagem horizontal (verificado ou declarado não verificado).
Do protótipo: todos os AC de `SPEC.md §7` com resultado registrado pelo QA, nenhum defeito "bloqueia demo" aberto, roteiro de demonstração escrito (`docs/prototype/DEMO.md`).

## 5. Backlog inicial e ordem de execução

| Onda | ID | Tarefa | Dono | Depende de | Critérios |
|---|---|---|---|---|---|
| 0 | T00 | Dependências, scripts (`typecheck`, `test`), branch, SPEC, agentes | orquestrador | — | `npm install` ok |
| 1 ‖ | T01 | Direção visual, tokens, `DESIGN.md` | ux-designer | T00 | AC07.2, AC08.1 |
| 1 ‖ | T02 | Tipos, regras puras, schemas, serviços mock, seed, testes | mock-engineer | T00 | §4 completo, AC04.x, AC05.x |
| 1 | T03 | Revisão cruzada de T01/T02 | code-reviewer | T01, T02 | — |
| 2 | T04 | `components/ui`, layout (header/nav), providers (sessão, toast), `lang`/metadata | frontend-engineer | T01, T02 | AC07.1, AC08.1 |
| 2 | T05 | Login, cadastro, guardas de rota, acesso negado, aviso RNF01, reiniciar demo | frontend-engineer | T04 | AC01.x |
| 3 ‖ | T06 | Busca, filtros, detalhe, registro de item | frontend-engineer A | T05 | AC02.x, AC03.x |
| 3 ‖ | T07 | Reivindicação, "Minhas reivindicações" | frontend-engineer A (depois de T06) | T06 | AC04.1–04.3, 04.7–04.8 |
| 3 ‖ | T08 | Painel admin, análise, editar/excluir, devolução, listagem de devoluções | frontend-engineer B | T05 | AC04.4–04.6, AC05.x, AC06.1 |
| 4 | T09 | Revisão + QA completos (matriz AC) | code-reviewer, qa-a11y | T06–T08 | todos |
| 5 | T10 | Correções priorizadas e reteste | donos | T09 | sem bloqueantes |
| 6 | T11 | `DEMO.md`, README de execução, relatório final; **confirmar com o usuário antes de push/PR** | orquestrador | T10 | §4 |

Opcionais (só com T10 concluída e tempo): indicador de pendências no painel admin; campo antifraude oculto.

## 6. Limites e confirmações

Pedir confirmação ao usuário antes de: `git push`, abrir PR, publicar/deploy, apagar branches, mudar infraestrutura, adicionar funcionalidade fora do escopo, ou reclassificar uma [Recomendação] como decisão. Decisões reversíveis de design/implementação: decidir, registrar a premissa e seguir.

## 7. Contexto que não vive no repositório (transferido explicitamente)

- Prazo do projeto: 27/10/2026; apresentação presencial com no máximo um slide e demonstração do produto funcionando.
- Processo adotado pela equipe: ágil (Scrum), Trello como quadro acompanhado pelo professor; PRs com um aprovador, branches `feature/rfXX-nome`.
- As decisões formais da equipe ainda estão em branco no documento de decisões (exceto a stack); este protótipo usa as **[Recomendações]** como premissas.
