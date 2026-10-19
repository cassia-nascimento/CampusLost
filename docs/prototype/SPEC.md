# CampusLost — Especificação do protótipo de frontend

> Documento operacional para a equipe de agentes. Fonte de verdade para o protótipo navegável **sem backend**.
> Escrito em 19/10/2026 a partir de: proposta do Mini-Projeto (PDF do professor) e do documento "CampusLost – Decisões de regras do sistema" (06/10/2026).

## 0. Como ler os rótulos de status

| Rótulo | Significado |
|---|---|
| **[Proposta]** | Definido no PDF do Mini-Projeto (professor). |
| **[Decisão da equipe]** | Aprovado formalmente pela equipe. Até 19/10 só a **stack** consta como decidida. |
| **[Recomendação]** | Sugerida no documento de decisões, **ainda pendente** de aprovação da equipe. É a premissa do protótipo, mas **não** deve ser apresentada como decisão aprovada. |
| **[Premissa do protótipo]** | Escolha provisória deste plano para preencher lacuna. Reversível. Listada na seção 9. |

## 1. Objetivo e escopo desta fase

Entregar um frontend **navegável e visualmente refinado**, que permita demonstrar o ciclo completo: entrar → registrar item → buscar → reivindicar → administração aprova → administração registra devolução → devolução aparece na listagem. Tudo com **mocks locais**; nenhum backend, banco ou autenticação real.

Fora do escopo (decisões documentadas): chat/mensagens, e-mail/push, exportação de relatório (PDF/planilha), status arquivado/expirado/descartado, tela "meus itens", migrações (Alembic), matrícula do aluno, edição das listas de categorias/locais por tela.

Opcionais (só após o fluxo principal estar completo): indicador de pendências no painel da administração; campo "detalhe oculto antifraude" (visível só à administração).

## 2. Perfis e permissões

| Capacidade | Aluno | Professor | Administração |
|---|:-:|:-:|:-:|
| Cadastrar-se / entrar (RF01) | ✔ | ✔ | só entra (conta de seed) |
| Registrar item encontrado (RF02) | ✔ | ✔ | ✔ |
| Buscar e ver itens (RF03) | ✔ | ✔ | ✔ |
| Reivindicar item (RF04) | ✔ | ✔ | ✘ (premissa) |
| Ver "Minhas reivindicações" | ✔ | ✔ | ✘ |
| Analisar (aceitar/recusar) reivindicações | ✘ | ✘ | ✔ |
| Editar / excluir item | ✘ | ✘ | ✔ |
| Registrar devolução (RF05) | ✘ | ✘ | ✔ |
| Ver listagem de devoluções | ✘ | ✘ | ✔ (premissa) |

Aluno e professor têm as mesmas permissões; o papel é autodeclarado no cadastro (limitação conhecida, registrada no documento de decisões).

**RNF01 no protótipo:** a proteção é **simulada no cliente** (guarda de rota por perfil). Deve haver aviso visível (rodapé/banner de demonstração) dizendo que autenticação e segurança reais dependem do backend futuro. Senhas **não são armazenadas nem verificadas**.

## 3. Modelo de domínio (contrato do frontend)

Identificadores em inglês no código; rótulos em português na interface.

- **User**: `id`, `name`, `email`, `role: "student" | "teacher" | "admin"`.
- **Item**: `id`, `title`, `description` (pública), `category`, `foundLocation`, `foundDate` (ISO), `storedAt` (onde está guardado agora), `photoDataUrl?`, `status: "available" | "under_claim" | "returned"`, `createdById`, `createdAt`.
- **Claim**: `id`, `itemId`, `claimantId`, `proofDetails`, `lostWhereWhen`, `status: "pending" | "accepted" | "rejected"`, `createdAt`, `reviewedAt?`.
- **ReturnRecord**: `id`, `itemId`, `claimId`, `returnedToId`, `registeredById`, `returnedAt`.

Rótulos de status na UI: Disponível · Em reivindicação · Devolvido. Reivindicação: Pendente · Aceita · Recusada.

Categorias e locais: **listas fixas** carregadas por seed, sem tela de edição. **[Premissa do protótipo]** valores demonstrativos tirados dos exemplos do próprio documento — categorias: Eletrônicos, Documentos, Roupas, Chaves, Outros; locais: Bloco A, Biblioteca, Cantina, Portaria. Devem vir de um único módulo, marcado como *dados demonstrativos*, e a interface de demonstração deve deixar claro que os valores finais virão da equipe.

## 4. Máquina de estados do item (respeitar rigorosamente)

| De | Para | Gatilho |
|---|---|---|
| Disponível | Em reivindicação | Chega a primeira reivindicação. |
| Em reivindicação | Devolvido | Administração registra a devolução. **Só** se existir reivindicação **aceita**. |
| Em reivindicação | Disponível | Todas as reivindicações do item foram recusadas (nenhuma pendente ou aceita). |

Regras associadas:
- Aceitar uma reivindicação **recusa automaticamente** todas as demais do item. O item **permanece** Em reivindicação até a devolução.
- Recusar uma reivindicação só devolve o item a Disponível se não restar nenhuma pendente/aceita.
- Reivindicação recusada **não pode ser reenviada** pelo mesmo usuário naquele item; a interface mostra "Recusada" e orienta procurar a administração.
- Devolução **não é desfeita** pelo sistema. Item Devolvido fica somente leitura (**[Premissa]**: sem editar/excluir) e some da busca.
- Nenhum outro status existe.
- **[Premissa]**: um usuário não pode ter duas reivindicações ativas (pendente/aceita) no mesmo item.

## 5. Telas e rotas (definitivas para esta fase)

| Rota | Tela | RF | Perfis | Justificativa |
|---|---|---|---|---|
| `/entrar` | Login (e-mail) + perfis de demonstração | RF01 | público | Entrada; atalhos de demo evitam digitar credenciais. |
| `/cadastro` | Cadastro (nome, e-mail, papel aluno/professor) | RF01 | público | Autocadastro. |
| `/itens` | Busca/listagem + filtros (categoria, local, período) | RF03 | logado | Tela inicial após login. Oculta devolvidos; mais recentes primeiro. |
| `/itens/[id]` | Detalhe do item | RF03/04 | logado | Mostra status, CTA "É meu" (usuário comum) ou ações administrativas. |
| `/itens/novo` | Registrar item encontrado | RF02 | logado | Foto, descrição, categoria, local, data, onde está guardado. |
| `/itens/[id]/reivindicar` | Formulário de reivindicação | RF04 | aluno/prof. | Validação por perguntas (sem chat). |
| `/minhas-reivindicacoes` | Acompanhamento de status | RF04 | aluno/prof. | Substitui notificações (decisão: acompanhar na interface). |
| `/admin` | Painel (reivindicações pendentes, itens em reivindicação) | RF04/05 | admin | Ponto de partida da administração. |
| `/admin/reivindicacoes/[id]` | Análise: aceitar/recusar | RF04 | admin | Compara descrição pública × resposta do usuário. |
| `/admin/itens/[id]/editar` | Editar item (e excluir com confirmação) | RF02 | admin | Só administração edita/exclui. |
| `/admin/devolucoes` | Listagem de devoluções (filtro por período; sem exportar) | RF05 | admin | Relatório simples. |

Registro da devolução é uma **ação com diálogo de confirmação** na análise/detalhe (não é rota própria). Não criar telas adicionais sem justificativa funcional registrada em `BACKLOG.md`.

Utilitário de demonstração (justificado): **"Reiniciar demonstração"** (restaura os dados de seed) acessível no menu do usuário e na tela de login.

## 6. Estados de interface obrigatórios

Para cada lista/formulário/ação: *carregando* (skeleton), *vazio*, *sem resultados do filtro*, *erro* (com tentar novamente), *sucesso* (toast/aviso) e *indisponível por permissão ou status* (explicando o porquê). Operações mockadas devem ter latência simulada curta (≈ 300–600 ms) e possibilidade de falha simulável apenas em testes.

## 7. Critérios de aceite (rastreáveis)

**RF01**
- AC01.1 Cadastro exige nome, e-mail válido e papel (aluno/professor); e-mail já usado mostra erro.
- AC01.2 Login por e-mail cadastrado cria sessão; e-mail inexistente mostra erro claro.
- AC01.3 Três perfis de demonstração (aluno, professor, administração) entram com um toque.
- AC01.4 Sessão persiste ao recarregar; sair encerra a sessão.
- AC01.5 Rotas privadas redirecionam visitante para `/entrar`; rotas `/admin/**` negam acesso a aluno/professor com tela "Acesso negado".
- AC01.6 Aviso de segurança simulada visível.

**RF02**
- AC02.1 Qualquer usuário logado registra item com título, descrição, categoria, local, data (não futura) e "onde está guardado agora".
- AC02.2 Foto opcional, com limite de tamanho/formato e pré-visualização.
- AC02.3 Item novo nasce Disponível e aparece no topo da busca.

**RF03**
- AC03.1 Busca exige login.
- AC03.2 Itens Devolvidos não aparecem; Em reivindicação aparecem identificados.
- AC03.3 Filtros de categoria, local e período combinam entre si; "Limpar filtros".
- AC03.4 Ordenação: mais recentes primeiro.
- AC03.5 Sem resultado → estado vazio com ação de limpar filtros.

**RF04**
- AC04.1 Usuário comum vê "É meu" em item Disponível/Em reivindicação, exceto se já tiver reivindicação ativa ou recusada naquele item, ou se o item já tiver uma reivindicação aceita (P14); o motivo é sempre explicado na tela.
- AC04.2 Enviar reivindicação muda item Disponível → Em reivindicação.
- AC04.3 Múltiplas reivindicações de usuários diferentes no mesmo item são permitidas.
- AC04.4 Administração vê e analisa reivindicações pendentes.
- AC04.5 Aceitar recusa automaticamente as demais; item permanece Em reivindicação.
- AC04.6 Recusar a última ativa devolve o item a Disponível.
- AC04.7 Usuário recusado vê status "Recusada" e não consegue reenviar.
- AC04.8 "Minhas reivindicações" reflete mudanças de status sem recarregar manualmente os dados.

**RF05**
- AC05.1 Só administração vê o botão "Registrar devolução", e só com reivindicação aceita.
- AC05.2 Confirmação em diálogo; ao confirmar, item → Devolvido, some da busca, aparece em `/admin/devolucoes`.
- AC05.3 Listagem de devoluções filtra por período; sem botão de exportar.

**Permissões de item**
- AC06.1 Só administração vê editar/excluir; exclusão exige confirmação; item Devolvido não é editável/excluível.

**RNF02**
- AC07.1 Todas as telas utilizáveis a partir de 360 px, sem rolagem horizontal da página.
- AC07.2 Alvos de toque ≥ 44 px nas ações principais.

**Acessibilidade básica**
- AC08.1 Formulários com `label` associado, erros anunciados (`aria-live`/`aria-describedby`), foco visível, navegação completa por teclado, contraste AA, diálogos com foco preso e `Esc`.

## 8. Arquitetura do frontend (preparada para API REST)

- Next.js 16 (App Router), `src/`, TypeScript estrito, Tailwind CSS 4, npm. Páginas interativas são Client Components (dados em `localStorage`).
- **Camadas**: `types` → `lib/rules` (funções puras da máquina de estados e permissões) → `services` (contratos + implementação mock) → `hooks` → `components` → `app`.
- Componentes e páginas **nunca** importam `services/mock/*` diretamente: usam `services` exportado de `src/services/index.ts`. Trocar por `services/api/*` (FastAPI) = mudar esse único ponto.
- Contratos assíncronos (`Promise`), erros tipados (`ServiceError` com `code`), sem vazar detalhes do mock para a UI.
- Persistência mock: `localStorage` com chave versionada e `seed` reproduzível; datas do seed relativas ao dia atual.
- Fontes **auto-hospedadas** (sem `next/font/google`): o build precisa funcionar offline.
- Bibliotecas permitidas: `react-hook-form`, `zod`, `@hookform/resolvers@5`, `lucide-react`, `clsx`, `tailwind-merge`. Dev: `vitest` (somente para regras de domínio, justificado pelo risco da máquina de estados). Sem axios, Redux/Zustand, UI kits pesados.

## 9. Conflitos e premissas provisórias (registro)

| # | Conflito / lacuna | Premissa adotada | Origem |
|---|---|---|---|
| P1 | Proposta diz "sistema de mensagens **ou** fluxo de validação" (RF04) | Fluxo de validação, sem chat | [Recomendação] |
| P2 | Proposta chama RF05 de "Relatório"; decisões falam em listagem simples | Listagem com filtro por período, sem exportar | [Recomendação] |
| P3 | Proposta cita "equipe de segurança/administração" | Um perfil "Administração", criado por seed | [Recomendação] |
| P4 | Campo "onde está guardado agora" é hipótese a confirmar | Incluído como obrigatório no RF02 | [Recomendação] |
| P5 | Listas de categorias/locais ainda sem valores reais | Valores demonstrativos dos exemplos do documento | [Premissa] |
| P6 | Foto é citada no RF02 mas sem regra de obrigatoriedade | Opcional, com limites e placeholder | [Premissa] |
| P7 | Campos exatos do formulário de reivindicação não definidos ("uma ou duas perguntas") | Duas perguntas obrigatórias: detalhes que só o dono saberia; onde e quando perdeu | [Premissa] |
| P8 | Administração pode reivindicar? Dono do registro pode reivindicar o próprio item? | Admin não reivindica; quem registrou pode (sem regra extra) | [Premissa] — **pendente de confirmação** |
| P9 | Quem acessa a listagem de devoluções | Só administração | [Premissa] |
| P10 | Item Devolvido: editar/excluir? | Somente leitura | [Premissa] |
| P11 | Campo de período filtra por qual data? | Data em que o item foi encontrado | [Premissa] |
| P12 | Busca por texto livre não consta no RF03 | Fora do escopo (só filtros) | [Premissa] |
| P13 | Proposta prevê sprints de 2 semanas; decisões falam em 3 sprints semanais; prazo 27/10/2026 | Não afeta o protótipo; cronograma segue o Trello da equipe | informativo |
| P14 | Pode haver novas reivindicações num item que já tem uma aceita? | Não: bloqueado até a devolução (evita duas aceitas) | [Premissa] (T02) |
| P15 | Reivindicação aceita pode ser desfeita/recusada depois? | Não; o item só sai de Em reivindicação pela devolução | [Premissa] (T02) |
| P16 | "Mais recentes primeiro" ordena por quê? | Data de registro do item (item novo vai ao topo); ordenar por data encontrada é opcional. Período da busca filtra pela data encontrada (P11); período de devoluções filtra pela data da devolução | [Premissa] (T02) |
| P17 | Fila de pendentes da administração | Da mais antiga para a mais nova | [Premissa] (T02) |
| P18 | Excluir item com reivindicações | Remove também as reivindicações (somem de "Minhas reivindicações") | [Premissa] (T02) |
| P19 | Destinatário da devolução | A autora/o autor da reivindicação aceita; sem campo livre | [Premissa] (T02) |
| P20 | Itens do seed e fotos | Seed sem fotos (UI usa placeholder); senhas não existem no protótipo | [Premissa] (T02) |

| P21 | Sessão compartilhada entre abas quebraria a demonstração com duas abas (aluno + administração) | Sessão em `sessionStorage` (por aba, sobrevive a recarregar); dados em `localStorage` compartilhados | [Premissa] (revisão T03-a) |
| P22 | Item pode mostrar ao usuário comum o motivo de não poder reivindicar sem expor reivindicações de terceiros | O serviço devolve `viewer.{claim,edit,delete,registerReturn}` (decisões prontas) em `items.get`; a UI só exibe | decisão técnica (revisão T03-a) |
| P23 | Painel admin lista uma linha por item em reivindicação, mas o item pode ter várias reivindicações | A linha mostra a reivindicação aceita, se houver; senão a pendente mais antiga | [Premissa] (T08) |
| P24 | Após registrar um item, o enunciado manda ir ao detalhe; DESIGN §9.5 diz voltar à lista | Vai ao detalhe do item criado (`router.replace`) | [Premissa] (T06) |
| P25 | DESIGN §9.9 manda voltar ao painel após registrar devolução | Abre `/admin/devolucoes`, onde a devolução recém-registrada já aparece (fecha o fluxo da demo) | [Premissa] (QA, decisão do orquestrador) |

Detalhes de implementação do domínio (códigos de erro, `subscribe`, chaves de storage, opções de teste) ficam documentados no código de `frontend/src/services/` e `frontend/src/lib/rules/`.
