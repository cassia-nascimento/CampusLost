# CampusLost — Especificação do protótipo de frontend

> Documento operacional para a equipe de agentes. Fonte de verdade para o protótipo navegável **sem backend**.
> Escrito em 19/10/2026 (atualizado em 25/10/2026: contas e segurança, P32–P39) a partir de: proposta do Mini-Projeto (PDF do professor) e do documento "CampusLost – Decisões de regras do sistema" (06/10/2026).

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

| Capacidade | Visitante | Aluno | Professor | Comunidade externa | Administração |
|---|:-:|:-:|:-:|:-:|:-:|
| Cadastrar-se / entrar (RF01) | ✔ | ✔ | ✔ | ✔ | só entra (conta de seed) |
| Registrar item encontrado (RF02) | ✘ | ✔ | ✔ | ✔ | ✔ |
| Buscar e ver itens (RF03) | ✔ (P26) | ✔ | ✔ | ✔ | ✔ |
| Reivindicar item (RF04) | ✘ | ✔ | ✔ | ✔ | ✘ (premissa) |
| Ver "Minhas reivindicações" | ✘ | ✔ | ✔ | ✔ | ✘ |
| Analisar (aceitar/recusar) reivindicações | ✘ | ✘ | ✘ | ✘ | ✔ |
| Editar / excluir item | ✘ | ✘ | ✘ | ✘ | ✔ |
| Registrar devolução (RF05) | ✘ | ✘ | ✘ | ✘ | ✔ |
| Ver listagem de devoluções | ✘ | ✘ | ✘ | ✘ | ✔ (premissa) |

Aluno, professor e **comunidade externa** (`external`) têm as mesmas permissões **[Premissa do protótipo, P32]**. Na coluna "Cadastrar-se / entrar", a administração não se autocadastra: entra com conta de seed ou por **convite de administração** (ver RF01).

Descrição dos perfis (25/10/2026, todas **[Premissa]**, a validar pela equipe):
- **Visitante**: sem conta; só vê lista e detalhe públicos (P26).
- **Aluno / Professor**: pessoa da UNDB. Pelo cadastro por e-mail e senha o papel é **autodeclarado** (limitação conhecida, registrada no documento de decisões); pelo Google, o domínio institucional é o que classifica a conta como aluno/professor (P30).
- **Comunidade externa**: pessoa sem vínculo institucional (ex.: visitante do campus que achou ou perdeu um objeto). Cadastra-se com e-mail e senha ou com Google de domínio não institucional (P32).
- **Administração**: conta de seed ou criada por convite; exige 2FA (TOTP) fora do modo demonstração (P35); gerencia usuários, convites e vê a auditoria.

Capacidades **exclusivas da administração** acrescentadas ao RF01: gerir usuários (listar, bloquear/desbloquear, alterar papel), convidar administradores e consultar o registro de auditoria. Aluno, professor e externa podem exportar e excluir os **próprios** dados (LGPD).

**RNF01 no protótipo:** a proteção é **simulada no cliente** (guarda de rota por perfil). **Decisão da usuária (20/10/2026):** o aviso visível de demonstração (banner e rodapé) foi removido da interface; a limitação passa a ser dita na apresentação e na documentação. Só permanece o aviso de armazenamento indisponível no navegador. Senhas **não são armazenadas nem verificadas**.

## 3. Modelo de domínio (contrato do frontend)

Identificadores em inglês no código; rótulos em português na interface.

- **User**: `id`, `name`, `email`, `role: "student" | "teacher" | "external" | "admin"` (`external` = comunidade externa, P32). Campos de conta acrescentados no backend: e-mail confirmado (sim/não), aceite de termos (versão e data), 2FA ativo (sim/não). **[Premissa]**: nomes exatos de campo ficam no contrato `docs/api/API.md`.
- **Item**: `id`, `title`, `description` (pública), `category`, `foundLocation`, `foundDate` (ISO), `storedAt` (onde está guardado agora; **não é exposto a visitantes**, P26), `photoDataUrl?` (data URL de foto enviada **ou** caminho `/seed/*.svg` das imagens ilustrativas do seed, P27), `status: "available" | "under_claim" | "returned"`, `createdById`, `createdAt`.
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
| `/entrar` | Login (e-mail e senha, ou Google) + perfis de demonstração | RF01 | público | Entrada; atalhos de demo evitam digitar credenciais. Inclui o caminho de "Esqueci a senha" e, para administração, o segundo fator (TOTP). |
| `/cadastro` | Cadastro (nome, e-mail, senha, papel aluno/professor/comunidade externa, aceite dos termos) | RF01 | público | Autocadastro. |
| `/` | Landing page: o que é o CampusLost, como funciona (4 passos), itens recentes e chamadas para entrar/cadastrar | RF03 | público (P26) | Porta de entrada. Quem já tem sessão vai para a página inicial do perfil. |
| `/itens` | Busca/listagem + filtros (categoria, local, período) | RF03 | **público (P26)** | Visitante vê e filtra; tela inicial após login. Oculta devolvidos; mais recentes primeiro. |
| `/itens/[id]` | Detalhe do item | RF03/04 | **público (P26)** | Mostra status. Visitante vê "Entre para reivindicar" no lugar de "É meu" e não vê "onde está guardado". Usuário comum vê "É meu"; administração vê as ações administrativas. |
| `/itens/novo` | Registrar item encontrado | RF02 | logado | Foto, descrição, categoria, local, data, onde está guardado. |
| `/itens/[id]/reivindicar` | Formulário de reivindicação | RF04 | aluno/prof. | Validação por perguntas (sem chat). |
| `/minhas-reivindicacoes` | Acompanhamento de status | RF04 | aluno/prof. | Substitui notificações (decisão: acompanhar na interface). |
| `/admin` | Painel (reivindicações pendentes, itens em reivindicação) | RF04/05 | admin | Ponto de partida da administração. |
| `/admin/reivindicacoes/[id]` | Análise: aceitar/recusar | RF04 | admin | Compara descrição pública × resposta do usuário. |
| `/admin/itens/[id]/editar` | Editar item (e excluir com confirmação) | RF02 | admin | Só administração edita/exclui. |
| `/admin/devolucoes` | Listagem de devoluções (filtro por período; sem exportar) | RF05 | admin | Relatório simples. |

**[Premissa, 25/10/2026]** O RF01 ampliado exige também telas de confirmação de e-mail, recuperação/redefinição de senha, configuração de 2FA, aceite de convite de administração, gestão de usuários e auditoria (administração), exportar/excluir meus dados e `/privacidade` (texto-modelo, P36). Os caminhos exatos são definidos na implementação e registrados no contrato; esta tabela não os fixa.

Registro da devolução é uma **ação com diálogo de confirmação** na análise/detalhe (não é rota própria). Não criar telas adicionais sem justificativa funcional registrada em `BACKLOG.md`.

Utilitário de demonstração (justificado): **"Reiniciar demonstração"** (restaura os dados de seed) acessível no menu do usuário (removido da tela de login por decisão da usuária em 20/10/2026).

## 6. Estados de interface obrigatórios

Para cada lista/formulário/ação: *carregando* (skeleton), *vazio*, *sem resultados do filtro*, *erro* (com tentar novamente), *sucesso* (toast/aviso) e *indisponível por permissão ou status* (explicando o porquê). Operações mockadas devem ter latência simulada curta (≈ 300–600 ms) e possibilidade de falha simulável apenas em testes.

## 7. Critérios de aceite (rastreáveis)

**RF01**
- AC01.1 Cadastro exige nome, e-mail válido, senha (política P33: mín. 10 caracteres e máx. 72 bytes) e papel (aluno, professor ou comunidade externa); e-mail já usado mostra erro (P29). *(Texto atualizado em 25/10/2026; antes: 8 a 72 caracteres e só aluno/professor.)*
- AC01.2 Login por e-mail e senha cria sessão; e-mail inexistente ou senha errada mostram o mesmo erro, "E-mail ou senha incorretos." (P29).
- AC01.7 "Entrar com Google" *(versão original de 22/10/2026, **substituída por AC01.12**)*: só com e-mail institucional da UNDB (domínio configurável, padrão `undb.edu.br`); e-mail de outro domínio recusado com "Use o e-mail institucional da UNDB." (P30). Vale apenas para o protótipo sem backend; no backend, ver AC01.12.
- AC01.3 Três perfis de demonstração (aluno, professor, administração) entram com um toque.
- AC01.4 Sessão persiste ao recarregar; sair encerra a sessão.
- AC01.5 Rotas privadas redirecionam visitante para `/entrar`; rotas `/admin/**` negam acesso a aluno/professor com tela "Acesso negado".
- ~~AC01.6 Aviso de segurança simulada visível.~~ **Removido** por decisão da usuária em 20/10/2026 (banner, rodapé e aviso em `/entrar` retirados).

**RF01 — detalhamento de 25/10/2026** (segurança e contas). Tudo abaixo é **[Recomendação]/[Premissa]** a validar pela equipe e pelo professor, **não** decisão aprovada (P32–P38). Os critérios valem para o backend (FastAPI); o protótipo só com mocks cumpre apenas o que o seu `localStorage` permite.

Requisitos (sem renumerar RF01):
- Cadastro e login por **e-mail e senha** e por **Google**; aceite de termos no cadastro.
- **Confirmação de e-mail** obrigatória para registrar item (RF02) e reivindicar (RF04); **recuperação de senha** por e-mail.
- **Política de senha**: mín. 10 caracteres, máx. 72 bytes, fora de uma lista de senhas comuns.
- **2FA TOTP obrigatório** para a administração; **bloqueio progressivo** de tentativas; **captcha Turnstile opcional**; **auditoria**; **gestão de usuários** e **convites de administração**; **LGPD** (exportar e excluir os próprios dados).

- AC01.8 **Aceite de termos.** Dado que estou no cadastro (e-mail ou primeiro acesso por Google), quando tento concluir sem marcar o aceite dos termos e da política de privacidade, então o cadastro não é criado e o campo mostra erro associado; quando marco o aceite e concluo, então a conta registra a versão dos termos aceita e a data.
- AC01.9 **Política de senha.** Dado que informo uma senha no cadastro ou na redefinição, quando ela tem menos de 10 caracteres, ou mais de 72 bytes em UTF-8 (contagem em bytes, não em caracteres), ou consta na lista de senhas comuns, então é recusada com mensagem que diz qual regra falhou; quando tem de 10 caracteres a 72 bytes e não é comum, então é aceita.
- AC01.10 **Confirmação de e-mail.** Dado que me cadastrei por e-mail e senha e não confirmei o e-mail, quando tento registrar item ou enviar reivindicação, então a ação é bloqueada com explicação e opção de reenviar a confirmação, mas ainda posso entrar e buscar itens; quando abro o link de confirmação válido, então as ações passam a ser permitidas; quando o link é inválido, expirado ou já usado, então vejo erro e posso pedir novo link.
- AC01.11 **Recuperação de senha.** Dado que peço recuperação informando um e-mail, quando o e-mail existe ou não existe, então a resposta na tela é a mesma ("Se o e-mail estiver cadastrado, enviaremos instruções."); quando uso o link válido e informo nova senha conforme AC01.9, então a senha muda e o link não pode ser reutilizado; quando o link está expirado ou já foi usado, então a troca é recusada. O prazo de validade do link é **[Ponto ainda não definido]**.
- AC01.12 **Login e cadastro por Google.** Dado que entro com Google com e-mail verificado pelo Google, quando o domínio é institucional (configurável, P30), então a conta é aluno ou professor (a pessoa escolhe no primeiro acesso) e o e-mail já conta como confirmado; quando o domínio é outro, então a conta é criada como comunidade externa sem perguntar o papel; quando o Google informa e-mail não verificado ou o token é inválido, então o acesso é recusado. Uma conta existente com o mesmo e-mail entra sem criar duplicata.
- AC01.13 **2FA da administração.** Dado que sou administradora(o) sem 2FA configurado, quando entro com senha correta, então só acesso a tela de configuração do 2FA (segredo manual e link `otpauth`, sem QR code, P35) e nenhuma rota `/admin/**`; dado que tenho 2FA ativo, quando informo senha correta mas código TOTP errado ou ausente, então a sessão não é criada; quando informo o código correto, então a sessão é criada. Aluno, professor e externa não são solicitados a informar TOTP. No modo demonstração (`DEMO_MODE`), a conta de administração de demonstração dispensa o 2FA.
- AC01.14 **Bloqueio progressivo.** Dado que errei a senha repetidamente para o mesmo e-mail, quando atinjo o limite de tentativas consecutivas, então novas tentativas são recusadas por um tempo de espera que aumenta a cada bloqueio sucessivo, e a mensagem não revela se o e-mail existe; quando a espera termina ou entro com sucesso antes do limite, então o contador é zerado. Os valores (limite, tempos) são **[Ponto ainda não definido]** e configuráveis.
- AC01.15 **Captcha Turnstile opcional.** Dado que a chave do Turnstile não está configurada, quando uso cadastro, login ou recuperação, então os formulários funcionam sem captcha; dado que a chave está configurada, quando envio sem token válido, então a requisição é recusada e a pessoa pode tentar de novo. **Não testado com captcha real** (P37).
- AC01.16 **Auditoria.** Dado que ocorre um evento sensível (login com sucesso ou falha, bloqueio, troca ou recuperação de senha, ativação de 2FA, convite, mudança de papel, bloqueio de usuário, exportação ou exclusão de dados), quando o evento termina, então um registro com data, tipo, autor e alvo é gravado; registros não têm senha, token nem código TOTP; só a administração os consulta e ninguém os edita pela interface.
- AC01.17 **Gestão de usuários.** Dado que sou administração autenticada com 2FA, quando abro a gestão de usuários, então vejo nome, e-mail, papel e situação (confirmado, bloqueado) de cada conta e posso bloquear/desbloquear e alterar papel, com diálogo de confirmação; aluno, professor e externa que acessam essa tela veem "Acesso negado"; a administração não pode bloquear nem rebaixar a própria conta nem remover a última administração ativa.
- AC01.18 **Convites de administração.** Dado que sou administração, quando convido um e-mail, então é gerado um convite de uso único com validade; quem abre o convite válido cria senha (AC01.9), configura o 2FA (AC01.13) e passa a ter papel de administração; convite usado, expirado ou revogado é recusado; não existe autocadastro como administração.
- AC01.19 **LGPD — exportar.** Dado que estou autenticada(o), quando peço a exportação dos meus dados, então recebo um arquivo com os dados da minha conta, minhas reivindicações e itens que registrei, sem hash de senha, segredo de 2FA ou dados de outras pessoas; o pedido fica na auditoria.
- AC01.20 **LGPD — excluir.** Dado que estou autenticada(o), quando peço a exclusão da conta e confirmo no diálogo (com a senha ou outro fator de reautenticação), então a conta e os dados pessoais são removidos ou anonimizados e a sessão é encerrada; o login seguinte com essas credenciais falha. O tratamento de itens e reivindicações que a pessoa criou (remover ou anonimizar) e a retenção da auditoria são **[Ponto ainda não definido]**; não há exclusão de conta de administração que seja a última ativa.
- AC01.21 **Papel externo.** Dado que tenho conta de comunidade externa com e-mail confirmado, quando uso o sistema, então posso registrar item, reivindicar e ver "Minhas reivindicações" como aluno/professor, e não acesso `/admin/**` ("Acesso negado"); sem e-mail confirmado, vale AC01.10.
- AC01.22 **Sessão.** Dado que entrei (backend), quando uso o sistema, então a sessão é mantida por cookie `HttpOnly` acessado pelo frontend via proxy do mesmo domínio e renovada por refresh rotativo; quando saio, então a sessão é invalidada no servidor; um refresh já usado é recusado (P34).

**RF02**
- AC02.1 Qualquer usuário logado registra item com título, descrição, categoria, local, data (não futura) e "onde está guardado agora".
- AC02.2 Foto opcional, com limite de tamanho/formato e pré-visualização.
- AC02.3 Item novo nasce Disponível e aparece no topo da busca.

**RF03**
- AC03.1 Visitante (sem login) vê a lista e o detalhe dos itens, mas sem "onde está guardado", sem dados de reivindicação e sem quem registrou (P26); itens Devolvidos aparecem como "não encontrado".
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
| P20 | Itens do seed e fotos | Seed sem fotos (UI usa placeholder; ver P27 para as imagens); senha de demonstração: ver P29 | [Premissa] (T02) |

| P21 | Sessão compartilhada entre abas quebraria a demonstração com duas abas (aluno + administração) | Sessão em `sessionStorage` (por aba, sobrevive a recarregar); dados em `localStorage` compartilhados | [Premissa] (revisão T03-a) |
| P22 | Item pode mostrar ao usuário comum o motivo de não poder reivindicar sem expor reivindicações de terceiros | O serviço devolve `viewer.{claim,edit,delete,registerReturn}` (decisões prontas) em `items.get`; a UI só exibe | decisão técnica (revisão T03-a) |
| P23 | Painel admin lista uma linha por item em reivindicação, mas o item pode ter várias reivindicações | A linha mostra a reivindicação aceita, se houver; senão a pendente mais antiga | [Premissa] (T08) |
| P24 | Após registrar um item, o enunciado manda ir ao detalhe; DESIGN §9.5 diz voltar à lista | Vai ao detalhe do item criado (`router.replace`) | [Premissa] (T06) |
| P25 | DESIGN §9.9 manda voltar ao painel após registrar devolução | Abre `/admin/devolucoes`, onde a devolução recém-registrada já aparece (fecha o fluxo da demo) | [Premissa] (QA, decisão do orquestrador) |
| P26 | Usuária pediu (22/10/2026) que qualquer pessoa possa ver os itens sem criar conta ou entrar; a recomendação anterior era exigir login (RF03) e alertava que a busca pública expõe fotos e dados | Lista e detalhe públicos para visitantes. Não aparecem ao visitante: "onde está guardado" e qualquer dado de reivindicação. Reivindicar, registrar item e demais telas continuam exigindo login (visitante vai para `/entrar` e volta ao item depois de entrar). Devolvidos continuam ocultos | **Decisão da usuária** (22/10/2026), ainda não confirmada pela equipe nem pelo professor |
| P27 | Seed sem fotos deixava a lista sem imagem | Os itens do seed ganham imagens ilustrativas originais (SVG em `frontend/public/seed/`), identificáveis como demonstrativas; fotos reais podem substituí-las. Itens criados pelo usuário continuam com foto enviada (data URL) | [Premissa] (substitui parte de P20) |
| P28 | Depois de entrar ou criar conta a partir do detalhe de um item, a pessoa deveria voltar ao item | `/entrar` e `/cadastro` aceitam `?next=/itens/{id}` (regex própria, somente esse formato; `/itens` com filtros **não** é aceito); sem `next`, vale a página inicial do perfil | [Premissa] (22/10/2026) |
| P29 | Login por e-mail e senha (a usuária pediu em 22/10/2026) num protótipo sem backend | Senha guardada só como hash PBKDF2-SHA-256 com sal, em registro separado do usuário, no navegador. As 5 contas `@demo.test` usam a senha de demonstração `demonstracao123`; os perfis de um toque entram sem digitar. **Atualizado em 25/10/2026:** a política de senha do cadastro passou a ser a de P33 (mín. 10 caracteres; antes 8); o hash PBKDF2 vale só para o protótipo sem backend, no backend vale bcrypt (P31). Erro único para e-mail inexistente ou senha errada. Isto **não é segurança real**: a proteção de verdade depende do backend | **Decisão da usuária** (login por senha); detalhes [Premissa] |
| P30 | Login com Google institucional (pedido em 22/10/2026) | Botão do Google Identity Services; o ID token é verificado em uma rota de servidor do Next (`/api/auth/google`) e só e-mails do domínio permitido entram. **Atualizado em 25/10/2026:** e-mail de domínio não institucional deixou de ser recusado e cria conta de comunidade externa (P32, AC01.12); a verificação do ID token no servidor continua. Domínio padrão `undb.edu.br` é **HIPÓTESE** (alunos e professores podem usar subdomínios; aceitamos o domínio e seus subdomínios) e é configurável por `NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS`. Precisa de um Client ID do Google (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`); sem ele o botão não aparece. Conta criada pelo Google não tem senha. Com o FastAPI, a verificação do token passa para o backend | **Decisão da usuária**; domínio e papel pedido no primeiro acesso são [Premissa] |
| P31 | O protótipo era só frontend; o enunciado pede a stack FastAPI + SQLite, e o frontend precisa trocar mock → API | Backend em `backend/` (FastAPI + SQLite via SQLAlchemy, `create_all` sem migrações) que reproduz os serviços do mock: login por senha com bcrypt, sessão por JWT (HS256, `Authorization: Bearer`; **substituída em 25/10/2026 por cookie HttpOnly + refresh rotativo via proxy, P34**), Google verificado no servidor (`tokeninfo`) com o mesmo domínio configurável, fotos gravadas em disco (`backend/uploads/`, servidas em `/uploads/*`, campo `photoUrl`), seed com os mesmos ids do mock e rotas `/demo/*` só com `DEMO_MODE=true`. Contrato em `docs/api/API.md`. Acrescentado em 25/10/2026: 2FA, convites, auditoria, confirmação de e-mail, recuperação de senha e bloqueio progressivo (P32–P38). **Hospedagem serverless (ex.: Vercel) não persiste o arquivo SQLite nem as fotos** (disco efêmero): em produção é preciso um host com disco persistente ou trocar o banco/armazenamento de fotos. **Hipótese a decidir pela equipe** | [Premissa] (a decidir pela equipe) |
| P32 | Pessoas sem vínculo com a UNDB (ex.: quem visita o campus) não cabem em aluno/professor | Novo papel **comunidade externa** (`external`) com as mesmas permissões de aluno/professor (tabela da seção 2). Cadastro por e-mail e senha (papel escolhido) ou por Google de domínio não institucional (cria `external` direto). O papel por e-mail/senha é autodeclarado e não verificado | [Premissa] (25/10/2026), a validar pela equipe e pelo professor |
| P33 | Política de senha | Mín. 10 caracteres, máx. 72 **bytes** (limite do bcrypt; emojis e acentos ocupam mais de 1 byte), fora de uma lista de senhas comuns. Sem exigência de maiúsculas/símbolos. A lista de comuns é curta e embutida (não cobre todos os casos) | [Premissa] (25/10/2026) |
| P34 | Sessão por token no `Authorization` fica acessível a scripts do navegador | No backend, sessão por **cookie HttpOnly** + refresh rotativo; o frontend (Next) repassa as chamadas por um **proxy no mesmo domínio**, para o cookie não depender de CORS. O protótipo só com mocks continua com `sessionStorage` (P21). Exige que frontend e API sejam hospedados de modo compatível com esse proxy | [Premissa] (25/10/2026) |
| P35 | Administração é o perfil de maior risco (aprova devoluções) | **2FA TOTP obrigatório** para administração, exceto no modo demonstração. Sem QR code (segredo manual + link `otpauth`), para não adicionar dependência. Sem códigos de recuperação definidos: perda do app depende de outra administração ou de intervenção manual **[Ponto ainda não definido]** | [Premissa] (25/10/2026) |
| P36 | LGPD: termos, privacidade, exportar e excluir | Aceite de termos no cadastro, exportação e exclusão dos próprios dados. Os textos de **termos e `/privacidade` são texto-modelo com lacunas**, **sem validação jurídica** nem de encarregado/controlador; não podem ser tratados como definitivos. Base legal, prazos de retenção e contato do encarregado: **[Ponto ainda não definido]** | [Premissa] (25/10/2026) |
| P37 | Confirmação de e-mail, recuperação de senha, Google e Turnstile dependem de serviços externos | E-mail confirmado é pré-requisito para registrar item e reivindicar (conta Google com e-mail verificado já nasce confirmada). Turnstile é opcional (sem chave, o formulário funciona). **NÃO testado de verdade:** envio real de e-mail, login Google real e captcha real; só testes automatizados com simulações (ou nada, onde for dito). A validar antes de qualquer apresentação que os cite como funcionando | [Premissa] (25/10/2026); **não testado** |
| P38 | Bloqueio progressivo, auditoria, gestão de usuários e convites de administração | Limites e tempos de bloqueio, validade de convites e de links, e retenção da auditoria são **[Ponto ainda não definido]**; os critérios AC01.14 a AC01.18 fixam o comportamento, não os números. Tentativas ficam registradas no banco (não em memória) | [Premissa] (25/10/2026) |
| P39 | Onde hospedar a API (SQLite e fotos em disco) | **Em aberto.** Segue valendo o alerta de P31: serverless não persiste disco. Nenhuma hospedagem foi escolhida, testada ou contratada | [Ponto ainda não definido] |

Detalhes de implementação do domínio (códigos de erro, `subscribe`, chaves de storage, opções de teste) ficam documentados no código de `frontend/src/services/` e `frontend/src/lib/rules/`.
