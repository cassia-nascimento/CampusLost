# Progresso do protótipo

Atualizado pelo orquestrador ao fim de cada onda.

| Onda | Situação | Observações |
|---|---|---|
| 0 — Preparação | Concluída (19/10/2026) | SPEC, CLAUDE.md, agentes, dependências (resolvers 5.x; @types/node 22 por causa do vitest 5), scripts `typecheck`/`test`. |
| 1 — Design + domínio/mocks | Concluída | T01: design system verificado (23 pares de contraste, 0 falhas). T02 + T02b (revisão independente): 189 testes, `viewer.*` no `ItemDetail`, sessão por aba (P21–P22). |
| 2 — Base de UI, sessão e guardas | Concluída | T04: lint, typecheck, test e **build passando**; verificação visual do agente a 360/1280 px. Limite de foto alinhado em 10 MB (entrada). |
| 3 — Telas (3 worktrees em paralelo) | Concluída e integrada | A, B e C mergeadas (e3972e6). Verificado pelo orquestrador no resultado integrado: lint limpo, typecheck ok, 209 testes (17 arquivos), build com 13 rotas. |
| 3b — Ajustes de integração (T10a) | Concluída (1332804) | ItemEditForm unificado ao ItemForm, voltar mobile preservando busca, toast × ActionBar, ItemCard a 360 px. Verificado no integrado: 215 testes, build ok. |
| 4 — Revisão e QA | Em andamento | Revisão independente (T09a) concluída: 0 bloqueantes, 2 importantes (I1 estado antigo na análise; I2 frases de status), 10 menores. QA no navegador (T09b) em andamento. |
| 5 — Correções | Em andamento | Rodada 1 (T10b) integrada (758c7cf): I1, I2, M1, M3, M4, M6–M9 e sugestões 1, 4, 7 corrigidos; verificado no integrado: 235 testes, build ok. Rodada 2 após o relatório de QA. |
| 6 — Demonstração | Pendente | |

## Pendências conhecidas
- Agentes de `.claude/agents/` ainda não validados como reconhecidos (exige sessão nova no repositório; `/agents`).
- Redimensionamento real de foto por canvas e evento `storage` entre abas: só testados com stubs; QA deve validar no navegador.
- Premissas aguardando confirmação da equipe: P8–P10, P14–P24 (ver SPEC §9).

## Exceções de processo e dívida técnica registradas
- T10b alterou também `components/ui/{Field,FileInput,status}.ts(x)` (compartilhados), `lib/validation/**` (limites exportados) e `services/index.ts` (reexport morto removido), com permissão excepcional do orquestrador.
- T10a (ce0e58a) alterou `lib/validation/{auth,item,photo}.ts` (dono: mock-engineer) apenas em textos de mensagens, com testes ajustados; T10b recebe permissão excepcional para `lib/validation/**` (limites exportados) e `services/index.ts`.
- Adiados conscientemente (revisão T09a): M2 (extrair `ClaimRow`/`ItemMeta` e padronizar formato da data de envio), M5 (decisão de permissão da análise via `viewer.review` no contrato), sugestões 2, 3, 5, 6 e 8.
- Limitação conhecida a constar no roteiro da demo (P18): excluir um item remove sem aviso a reivindicação pendente de quem a fez.
