# Progresso do protótipo

Atualizado pelo orquestrador ao fim de cada onda.

| Onda | Situação | Observações |
|---|---|---|
| 0 — Preparação | Concluída (19/10/2026) | SPEC, CLAUDE.md, agentes, dependências (resolvers 5.x; @types/node 22 por causa do vitest 5), scripts `typecheck`/`test`. |
| 1 — Design + domínio/mocks | Concluída | T01: design system verificado (23 pares de contraste, 0 falhas). T02 + T02b (revisão independente): 189 testes, `viewer.*` no `ItemDetail`, sessão por aba (P21–P22). |
| 2 — Base de UI, sessão e guardas | Concluída | T04: lint, typecheck, test e **build passando**; verificação visual do agente a 360/1280 px. Limite de foto alinhado em 10 MB (entrada). |
| 3 — Telas (3 worktrees em paralelo) | Concluída e integrada | A, B e C mergeadas (e3972e6). Verificado pelo orquestrador no resultado integrado: lint limpo, typecheck ok, 209 testes (17 arquivos), build com 13 rotas. |
| 3b — Ajustes de integração (T10a) | Em andamento | Unificar ItemEditForm/ItemForm, voltar mobile preservando filtros, toast × ActionBar, ItemCard a 360 px. |
| 4 — Revisão e QA | Pendente | |
| 5 — Correções | Pendente | |
| 6 — Demonstração | Pendente | |

## Pendências conhecidas
- Agentes de `.claude/agents/` ainda não validados como reconhecidos (exige sessão nova no repositório; `/agents`).
- Redimensionamento real de foto por canvas e evento `storage` entre abas: só testados com stubs; QA deve validar no navegador.
- Premissas aguardando confirmação da equipe: P8–P10, P14–P24 (ver SPEC §9).
