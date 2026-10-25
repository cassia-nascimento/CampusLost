# Progresso do protótipo

Atualizado pelo orquestrador ao fim de cada onda.

| Onda | Situação | Observações |
|---|---|---|
| 0 — Preparação | Concluída (19/10/2026) | SPEC, CLAUDE.md, agentes, dependências (resolvers 5.x; @types/node 22 por causa do vitest 5), scripts `typecheck`/`test`. |
| 1 — Design + domínio/mocks | Concluída | T01: design system verificado (23 pares de contraste, 0 falhas). T02 + T02b (revisão independente): 189 testes, `viewer.*` no `ItemDetail`, sessão por aba (P21–P22). |
| 2 — Base de UI, sessão e guardas | Concluída | T04: lint, typecheck, test e **build passando**; verificação visual do agente a 360/1280 px. Limite de foto alinhado em 10 MB (entrada). |
| 3 — Telas (3 worktrees em paralelo) | Concluída e integrada | A, B e C mergeadas (e3972e6). Verificado pelo orquestrador no resultado integrado: lint limpo, typecheck ok, 209 testes (17 arquivos), build com 13 rotas. |
| 3b — Ajustes de integração (T10a) | Concluída (1332804) | ItemEditForm unificado ao ItemForm, voltar mobile preservando busca, toast × ActionBar, ItemCard a 360 px. Verificado no integrado: 215 testes, build ok. |
| 4 — Revisão e QA | Concluída (1ª passada) | Revisão independente (T09a): 0 bloqueantes, 2 importantes, 10 menores. QA no navegador (T09b, Chromium): aprovado com ressalvas, 0 bloqueia demo/alta, 2 médias, 10 baixas; 5 itens antes "não verificados" verificados (foto por canvas, sync entre abas, erro de carga, reiniciar demo, sem localStorage). Relatório: `qa/RELATORIO-QA.md`. |
| 5 — Correções | Em andamento | Rodada 1 (T10b) integrada (758c7cf): I1, I2, M1, M3, M4, M6–M9 e sugestões 1, 4, 7 corrigidos; verificado no integrado: 235 testes, build ok. Rodada 2 (T10c, defeitos do QA) integrada (71f8662): D1–D12 corrigidos (D2 já na T10b); verificado no integrado: 239 testes, build ok; scripts do QA reexecutados pelo agente: responsive seed/stress 0 transbordos, axe 91 estados 0 violações, e2e 32/32. Regressão final feita pelo orquestrador (`qa/RELATORIO-QA.md` §8): e2e 32/32, a11y 91/91, touch 33/33, storage 11/11, search 19/19, states 19/19, responsividade 230 combinações sem transbordo; `DEMO.md` validado em 390 e 1280 px e corrigido. Não reconfirmados por mim: forms, photo, misc, keyboard. |
| 6 — Demonstração | Quase concluída | `DEMO.md` e README prontos e validados; falta apenas o relatório final ao usuário (antes de qualquer PR, perguntar). |

## Decisões posteriores
- 20/10/2026 (usuária): removidos o banner e o rodapé de demonstração, o aviso de modo demonstração em `/entrar` e o botão "Reiniciar demonstração" da tela de entrada (continua no Menu da conta). Permanece só o aviso de armazenamento indisponível. Os registros anteriores (relatório de QA, ondas acima) descrevem o estado antes dessa mudança.

## Pendências conhecidas
- Agentes de `.claude/agents/` ainda não validados como reconhecidos (exige sessão nova no repositório; `/agents`).
- Redimensionamento real de foto por canvas e evento `storage` entre abas: só testados com stubs; QA deve validar no navegador.
- Premissas aguardando confirmação da equipe: P8–P10, P14–P25 (ver SPEC §9).

## Exceções de processo e dívida técnica registradas
- T10b alterou também `components/ui/{Field,FileInput,status}.ts(x)` (compartilhados), `lib/validation/**` (limites exportados) e `services/index.ts` (reexport morto removido), com permissão excepcional do orquestrador.
- T10a (ce0e58a) alterou `lib/validation/{auth,item,photo}.ts` (dono: mock-engineer) apenas em textos de mensagens, com testes ajustados; T10b recebe permissão excepcional para `lib/validation/**` (limites exportados) e `services/index.ts`.
- Adiados conscientemente (revisão T09a): M2 (extrair `ClaimRow`/`ItemMeta` e padronizar formato da data de envio), M5 (decisão de permissão da análise via `viewer.review` no contrato), sugestões 2, 3, 5, 6 e 8.
- Limitação conhecida a constar no roteiro da demo (P18): excluir um item remove sem aviso a reivindicação pendente de quem a fez.

## Decisões posteriores — 25/10/2026 (segurança e contas)

Todas são **[Premissa]** do protótipo, a validar pela equipe (não são decisões aprovadas):

- Novo papel **comunidade externa** (`external`), com as mesmas permissões de aluno/professor. Cadastro por senha (e-mail confirmado) ou Google (qualquer conta; domínio institucional escolhe aluno/professor).
- E-mail precisa ser confirmado para cadastrar itens e reivindicar. Senha: mín. 10 caracteres, máx. 72 bytes, fora da lista de comuns.
- Recuperação de senha por e-mail; sessões por cookie HttpOnly + refresh rotativo (backend); limite de tentativas de login no banco.
- Administração: gestão de usuários, convites de administrador, auditoria e 2FA (TOTP) obrigatório para admin (exceto demonstração). 2FA sem QR code (segredo manual + link otpauth), para não adicionar dependência.
- LGPD: aceite dos termos, exportar e excluir dados. `/privacidade` é **texto-modelo** com lacunas a preencher pela equipe.
- Pendente de teste real: envio de e-mail, login Google, captcha (Turnstile). Hospedagem da API com disco persistente segue indefinida.
