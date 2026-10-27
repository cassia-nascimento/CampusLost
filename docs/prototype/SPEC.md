# CampusLost — Especificação do protótipo de frontend

> Documento operacional para a equipe de agentes. Fonte de verdade para o protótipo navegável **sem backend**.
> Escrito em 19/10/2026 (atualizado em 25/10/2026: contas e segurança, P32–P39; revisado em 27/10/2026: papéis de acesso `user`/`admin` e vínculo por domínio de e-mail, P32 e P40) a partir de: proposta do Mini-Projeto (PDF do professor) e do documento "CampusLost – Decisões de regras do sistema" (06/10/2026).

## 0. Como ler os rótulos de status

| Rótulo | Significado |
|---|---|
| **[Proposta]** | Definido no PDF do Mini-Projeto (professor). |
| **[Decisão da equipe]** | Aprovado formalmente pela equipe. Até 19/10 só a **stack** consta como decidida. |
| **[Recomendação]** | Sugerida no documento de decisões, **ainda pendente** de aprovação da equipe. É a premissa do protótipo, mas **não** deve ser apresentada como decisão aprovada. |
| **[Premissa do protótipo]** | Escolha provisória deste plano para preencher lacuna. Reversível. Listada na seção 9. |

## 1. Objetivo e escopo desta fase

Entregar um frontend **navegável e visualmente refinado**, que permita demonstrar o ciclo completo: entrar → registrar item → buscar → reivindicar → administração aprova → administração registra devolução → devolução aparece na listagem. Tudo com **mocks locais**; nenhum backend, banco ou autenticação real.

Fora do escopo (decisões documentadas): chat/mensagens, e-mail/push, exportação de relatório (PDF/planilha), status arquivado/expirado/descartado, tela "meus itens", migrações (Alembic) no protótipo só com mocks (o backend as usa, ver P40), verificação de matrícula ou de vínculo com a UNDB, edição das listas de categorias/locais por tela.

Opcionais (só após o fluxo principal estar completo): indicador de pendências no painel da administração; campo "detalhe oculto antifraude" (visível só à administração).

## 2. Perfis e permissões

**[Premissa, revisada em 27/10/2026]** Não há mais perfis de aluno, professor ou comunidade externa no cadastro nem no modelo. Existem dois **papéis de acesso** (`role`): `user` (usuário comum) e `admin` (administração). Todos os usuários comuns têm as **mesmas permissões**. Separado disso, cada conta tem um **vínculo** (`affiliation`): `institutional` ou `external`, derivado **somente do domínio do e-mail** (P40). O vínculo **não** concede permissão e **não é verificado**.

| Capacidade | Visitante | Usuário | Administração |
|---|:-:|:-:|:-:|
| Cadastrar-se / entrar (RF01) | ✔ | ✔ | só entra (conta de seed, convite ou promoção por outra administração) |
| Registrar item encontrado (RF02) | ✘ | ✔ | ✔ |
| Buscar e ver itens (RF03) | ✔ (P26) | ✔ | ✔ |
| Reivindicar item (RF04) | ✘ | ✔ | ✘ (premissa) |
| Ver "Minhas reivindicações" | ✘ | ✔ | ✘ |
| Analisar (aceitar/recusar) reivindicações | ✘ | ✘ | ✔ |
| Editar / excluir item | ✘ | ✘ | ✔ |
| Registrar devolução (RF05) | ✘ | ✘ | ✔ |
| Ver listagem de devoluções | ✘ | ✘ | ✔ (premissa) |
| Gerir usuários, convidar administradores, consultar auditoria | ✘ | ✘ | ✔ |
| Exportar e excluir os **próprios** dados (LGPD) | ✘ | ✔ | ✔ |

Descrição (27/10/2026, todas **[Premissa]**, a validar pela equipe):
- **Visitante**: sem conta; só vê lista e detalhe públicos (P26).
- **Usuário** (`role: user`): qualquer pessoa com conta comum. O cadastro pede nome, e-mail, senha e aceite dos termos; **não pergunta "quem você é"**. O vínculo `institutional`/`external` sai do domínio do e-mail (domínio ou subdomínio dos configurados em `NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS` / `GOOGLE_ALLOWED_DOMAINS`; padrão `undb.edu.br`, **hipótese**) e **não é verificado**: não há integração com a UNDB nem consulta de matrícula, então ter e-mail do domínio não prova ser aluno ou professor.
- **Administração** (`role: admin`): **nenhuma rota de cadastro cria administração** (nem por e-mail e senha, nem pelo Google). Só se torna admin por `python -m app.create_admin`, por convite de administração ou por promoção feita por outra administração. Exige 2FA (TOTP) fora do modo demonstração (P35). As permissões são **validadas no backend**; a interface só esconde o que a pessoa não pode fazer.

Capacidades **exclusivas da administração** acrescentadas ao RF01: gerir usuários (listar, bloquear/desbloquear, alterar papel `user`/`admin`), convidar administradores e consultar o registro de auditoria. Todo usuário pode exportar e excluir os **próprios** dados (LGPD).

**RNF01 no protótipo:** a proteção é **simulada no cliente** (guarda de rota por papel de acesso). **Decisão da usuária (20/10/2026):** o aviso visível de demonstração (banner e rodapé) foi removido da interface; a limitação passa a ser dita na apresentação e na documentação. Só permanece o aviso de armazenamento indisponível no navegador. Senhas **não são armazenadas nem verificadas**.

## 3. Modelo de domínio (contrato do frontend)

Identificadores em inglês no código; rótulos em português na interface.

- **User**: `id`, `name`, `email`, `role: "user" | "admin"` (papel de acesso) e `affiliation: "institutional" | "external"` (vínculo derivado do domínio do e-mail, não verificado; P40). Campos de conta acrescentados no backend: e-mail confirmado (sim/não), aceite de termos (versão e data), 2FA ativo (sim/não). **[Premissa]**: nomes exatos de campo ficam no contrato `docs/api/API.md`.
- **Item**: `id`, `title`, `description` (pública), `category`, `categoryOther` (especificação da categoria; só com `category = "Outros"`, senão `null`; P41), `foundLocation` (texto livre, 3 a 120 caracteres; P42), `foundDate` (ISO), `storedAt` (onde está guardado agora; **obrigatório no registro e na edição** (3 a 120 caracteres) e **privado**: só a administração e quem tem reivindicação **aceita** nesse item, enquanto ele aguarda devolução, o recebem; para os demais a chave é omitida; P43), `photoDataUrl?` (data URL de foto enviada **ou** caminho `/seed/*.svg|webp` das imagens demonstrativas do seed, P27), `status: "available" | "under_claim" | "returned"`, `createdById`, `createdAt`.
- **Claim**: `id`, `itemId`, `claimantId`, `proofDetails`, `lostWhereWhen`, `status: "pending" | "accepted" | "rejected"`, `createdAt`, `reviewedAt?`.
- **ReturnRecord**: `id`, `itemId`, `claimId`, `returnedToId`, `registeredById`, `returnedAt`.

Rótulos de status na UI: Disponível · Em reivindicação · Devolvido. Reivindicação: Pendente · Aceita · Recusada.

Categorias e locais: **listas fixas** carregadas por seed, sem tela de edição. **[Premissa do protótipo]** valores demonstrativos tirados dos exemplos do próprio documento — categorias: Eletrônicos, Documentos, Roupas, Chaves, Outros. O **local onde foi encontrado não é lista**: é texto livre (P42); "Bloco A", "Biblioteca", "Cantina" e "Portaria" existem só como exemplos do seed. Devem vir de um único módulo, marcado como *dados demonstrativos*, e a interface de demonstração deve deixar claro que os valores finais virão da equipe.

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

| Rota | Tela | RF | Quem acessa | Justificativa |
|---|---|---|---|---|
| `/entrar` | Login (e-mail e senha, ou Google) + atalhos de demonstração (Usuário, Administração) | RF01 | público | Entrada; atalhos de demo evitam digitar credenciais. Inclui o caminho de "Esqueci a senha" e, para administração, o segundo fator (TOTP). |
| `/cadastro` | Cadastro (nome, e-mail, senha, aceite dos termos; sem escolha de papel) | RF01 | público | Autocadastro. |
| `/` | Landing page: o que é o CampusLost, como funciona (4 passos), itens recentes e chamadas para entrar/cadastrar | RF03 | público (P26) | Porta de entrada. Quem já tem sessão vai para a página inicial do seu papel. |
| `/itens` | Busca/listagem + filtros (categoria, local por texto, período) | RF03 | **público (P26)** | Visitante vê e filtra; tela inicial após login. Oculta devolvidos; mais recentes primeiro. |
| `/itens/[id]` | Detalhe do item | RF03/04 | **público (P26)** | Mostra status. Visitante vê "Entre para reivindicar" no lugar de "É meu" e não vê "onde está guardado" (só a administração e o reivindicante aceito veem; P43). Usuário comum vê "É meu"; administração vê as ações administrativas. |
| `/itens/novo` | Registrar item encontrado | RF02 | logado | Foto (arquivo ou câmera), descrição, categoria (com especificação em "Outros"), local (texto livre), data e onde está guardado agora (obrigatório). |
| `/itens/[id]/reivindicar` | Formulário de reivindicação | RF04 | usuário | Validação por perguntas (sem chat). |
| `/minhas-reivindicacoes` | Acompanhamento de status | RF04 | usuário | Substitui notificações (decisão: acompanhar na interface). |
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
- AC01.1 **Cadastro.** Dado que estou em `/cadastro`, quando envio nome, e-mail válido, senha conforme AC01.9 e o aceite dos termos, então a conta é criada com papel `user` e vínculo derivado do domínio do e-mail (P40), sem que eu escolha papel nem vínculo; quando o e-mail já tem conta, então vejo erro de e-mail já usado (P29); quando a requisição traz um campo de papel, então ele é ignorado e a conta nasce `user`. *(Reescrito em 27/10/2026; antes pedia papel aluno, professor ou comunidade externa.)*
- AC01.2 Login por e-mail e senha cria sessão; e-mail inexistente ou senha errada mostram o mesmo erro, "E-mail ou senha incorretos." (P29).
- AC01.7 "Entrar com Google" *(versão original de 22/10/2026, **substituída por AC01.12**)*: só com e-mail institucional da UNDB (domínio configurável, padrão `undb.edu.br`); e-mail de outro domínio recusado com "Use o e-mail institucional da UNDB." (P30). Vale apenas para o protótipo sem backend; no backend, ver AC01.12.
- AC01.3 **Perfis de demonstração.** Dado que estou em `/entrar`, quando toco em um dos dois atalhos ("Usuário" e "Administração"), então entro com essa conta sem digitar senha: o primeiro é `role: user` com vínculo `institutional`, o segundo `role: admin`; os atalhos ficam sem título visível e não existe atalho para a conta externa (`externo@demo.test`, `user` + `external`), que entra por e-mail e senha de demonstração. *(Revisado em 27/10/2026; antes: três perfis.)*
- AC01.4 Sessão persiste ao recarregar; sair encerra a sessão.
- AC01.5 **Guarda de rotas.** Dado que sou visitante, quando abro uma rota privada, então vou para `/entrar`; dado que sou usuário comum (`role: user`), quando abro `/admin/**`, então vejo "Acesso negado", independentemente do vínculo.
- ~~AC01.6 Aviso de segurança simulada visível.~~ **Removido** por decisão da usuária em 20/10/2026 (banner, rodapé e aviso em `/entrar` retirados).

**RF01 — como continua atendido (27/10/2026).** O texto da proposta fala em "autenticação de alunos, professores e equipe de segurança/administração". **[Premissa]** Interpretamos como: **autenticação de usuários da comunidade** (qualquer pessoa com conta comum, `role: user`), com **vínculo por e-mail institucional** (`affiliation`, derivado do domínio do e-mail e **não verificado**, P40), **mais a administração** (`role: admin`). A distinção aluno × professor deixou de existir no sistema porque não há como verificá-la (sem integração com a UNDB). Se o professor exigir essa distinção, é **[Ponto ainda não definido]** e depende de fonte confiável de vínculo (seção 10).

**RNF01 — como continua atendido (27/10/2026).** No backend, por senhas guardadas com **bcrypt** e por **checagem do papel de administração no servidor** em cada rota administrativa (AC01.23); o frontend só oculta ações. No protótipo só com mocks, a proteção segue simulada (seção 2).

**RF01 — detalhamento de 25/10/2026** (segurança e contas). Tudo abaixo é **[Recomendação]/[Premissa]** a validar pela equipe e pelo professor, **não** decisão aprovada (P32–P38, P40). Os critérios valem para o backend (FastAPI); o protótipo só com mocks cumpre apenas o que o seu `localStorage` permite.

Requisitos (sem renumerar RF01):
- Cadastro e login por **e-mail e senha** e por **Google**; aceite de termos no cadastro.
- **Confirmação de e-mail** obrigatória para registrar item (RF02) e reivindicar (RF04); **recuperação de senha** por e-mail.
- **Política de senha**: mín. 10 caracteres, máx. 72 bytes, fora de uma lista de senhas comuns.
- **2FA TOTP obrigatório** para a administração; **bloqueio progressivo** de tentativas; **captcha Turnstile opcional**; **auditoria**; **gestão de usuários** e **convites de administração**; **LGPD** (exportar e excluir os próprios dados).

- AC01.8 **Aceite de termos.** Dado que estou no cadastro (e-mail ou primeiro acesso por Google), quando tento concluir sem marcar o aceite dos termos e da política de privacidade, então o cadastro não é criado e o campo mostra erro associado; quando marco o aceite e concluo, então a conta registra a versão dos termos aceita e a data.
- AC01.9 **Política de senha.** Dado que informo uma senha no cadastro ou na redefinição, quando ela tem menos de 10 caracteres, ou mais de 72 bytes em UTF-8 (contagem em bytes, não em caracteres), ou consta na lista de senhas comuns, então é recusada com mensagem que diz qual regra falhou; quando tem de 10 caracteres a 72 bytes e não é comum, então é aceita.
- AC01.10 **Confirmação de e-mail.** Dado que me cadastrei por e-mail e senha e não confirmei o e-mail, quando tento registrar item ou enviar reivindicação, então a ação é bloqueada com explicação e opção de reenviar a confirmação, mas ainda posso entrar e buscar itens; quando abro o link de confirmação válido, então as ações passam a ser permitidas; quando o link é inválido, expirado ou já usado, então vejo erro e posso pedir novo link.
- AC01.11 **Recuperação de senha.** Dado que peço recuperação informando um e-mail, quando o e-mail existe ou não existe, então a resposta na tela é a mesma ("Se o e-mail estiver cadastrado, enviaremos instruções."); quando uso o link válido e informo nova senha conforme AC01.9, então a senha muda e o link não pode ser reutilizado; quando o link está expirado ou já foi usado, então a troca é recusada. O prazo de validade do link é **[Ponto ainda não definido]**.
- AC01.12 **Login e cadastro por Google.** Dado que entro com Google com e-mail verificado pelo Google, quando a conta ainda não existe, então vejo só o aceite dos termos (sem escolha de papel) e a conta só é criada depois do aceite, com `role: user` e vínculo `institutional` se o domínio for o configurado (ou subdomínio, P30/P40) ou `external` caso contrário, e o e-mail já conta como confirmado; quando o Google informa e-mail não verificado ou o token é inválido, então o acesso é recusado. Uma conta existente com o mesmo e-mail entra sem criar duplicata.
- AC01.13 **2FA da administração.** Dado que sou administradora(o) sem 2FA configurado, quando entro com senha correta, então só acesso a tela de configuração do 2FA (segredo manual e link `otpauth`, sem QR code, P35) e nenhuma rota `/admin/**`; dado que tenho 2FA ativo, quando informo senha correta mas código TOTP errado ou ausente, então a sessão não é criada; quando informo o código correto, então a sessão é criada. Usuários comuns (`role: user`) não são solicitados a informar TOTP. No modo demonstração (`DEMO_MODE`), a conta de administração de demonstração dispensa o 2FA.
- AC01.14 **Bloqueio progressivo.** Dado que errei a senha repetidamente para o mesmo e-mail, quando atinjo o limite de tentativas consecutivas, então novas tentativas são recusadas por um tempo de espera que aumenta a cada bloqueio sucessivo, e a mensagem não revela se o e-mail existe; quando a espera termina ou entro com sucesso antes do limite, então o contador é zerado. Os valores (limite, tempos) são **[Ponto ainda não definido]** e configuráveis.
- AC01.15 **Captcha Turnstile opcional.** Dado que a chave do Turnstile não está configurada, quando uso cadastro, login ou recuperação, então os formulários funcionam sem captcha; dado que a chave está configurada, quando envio sem token válido, então a requisição é recusada e a pessoa pode tentar de novo. **Não testado com captcha real** (P37).
- AC01.16 **Auditoria.** Dado que ocorre um evento sensível (login com sucesso ou falha, bloqueio, troca ou recuperação de senha, ativação de 2FA, convite, mudança de papel, bloqueio de usuário, exportação ou exclusão de dados), quando o evento termina, então um registro com data, tipo, autor e alvo é gravado; registros não têm senha, token nem código TOTP; só a administração os consulta e ninguém os edita pela interface.
- AC01.17 **Gestão de usuários.** Dado que sou administração autenticada com 2FA, quando abro a gestão de usuários, então vejo nome, e-mail, papel, vínculo (`institutional`/`external`) e situação (confirmado, bloqueado) de cada conta e posso bloquear/desbloquear e alterar o papel (`user`/`admin`), com diálogo de confirmação; usuário comum que acessa essa tela vê "Acesso negado"; a administração não pode bloquear nem rebaixar a própria conta nem remover a última administração ativa.
- AC01.18 **Convites de administração.** Dado que sou administração, quando convido um e-mail, então é gerado um convite de uso único com validade; quem abre o convite válido cria senha (AC01.9), configura o 2FA (AC01.13) e passa a ter `role: admin`; convite usado, expirado ou revogado é recusado; nenhuma rota de cadastro (senha ou Google) cria administração.
- AC01.19 **LGPD — exportar.** Dado que estou autenticada(o), quando peço a exportação dos meus dados, então recebo um arquivo com os dados da minha conta, minhas reivindicações e itens que registrei, sem hash de senha, segredo de 2FA ou dados de outras pessoas; o pedido fica na auditoria.
- AC01.20 **LGPD — excluir.** Dado que estou autenticada(o), quando peço a exclusão da conta e confirmo no diálogo (com a senha ou outro fator de reautenticação), então a conta e os dados pessoais são removidos ou anonimizados e a sessão é encerrada; o login seguinte com essas credenciais falha. O tratamento de itens e reivindicações que a pessoa criou (remover ou anonimizar) e a retenção da auditoria são **[Ponto ainda não definido]**; não há exclusão de conta de administração que seja a última ativa.
- AC01.21 **Vínculo não altera permissões.** Dado que tenho conta `user` com e-mail confirmado, quando uso o sistema, então posso registrar item, reivindicar e ver "Minhas reivindicações" tanto com vínculo `institutional` quanto `external`, e não acesso `/admin/**` ("Acesso negado"); sem e-mail confirmado, vale AC01.10. *(Substitui o antigo "Papel externo", 27/10/2026.)*
- AC01.23 **Permissões no servidor.** Dado que sou usuário comum, quando chamo diretamente uma rota de administração (por exemplo gestão de usuários ou análise de reivindicação) sem passar pela interface, então o backend recusa com erro de permissão, e a checagem não depende do vínculo nem de dados enviados pelo cliente. Dado que um cliente envia `role: admin` em qualquer rota de cadastro, então o campo é ignorado.
- AC01.22 **Sessão.** Dado que entrei (backend), quando uso o sistema, então a sessão é mantida por cookie `HttpOnly` acessado pelo frontend via proxy do mesmo domínio e renovada por refresh rotativo; quando saio, então a sessão é invalidada no servidor; um refresh já usado é recusado (P34).

**RF02**
- AC02.1 Qualquer usuário logado (comum ou administração) registra item com título, descrição, categoria, local onde foi encontrado, data (não futura) e "onde está guardado agora" (obrigatório).
- AC02.2 Foto opcional, com limite de tamanho/formato e pré-visualização. Duas ações lado a lado (empilhadas a 360 px): **Enviar foto** (escolher arquivo) e **Tirar foto** (câmera nativa do navegador via `<input capture>`, sem biblioteca nem acesso próprio à câmera). As duas passam pela mesma validação de formato e tamanho; se a câmera devolver formato não aceito (ex.: HEIC), aparece a mensagem de formato. Sem câmera disponível (ex.: desktop), "Tirar foto" abre o seletor de arquivo e o texto de ajuda manda usar "Enviar foto". Há "Trocar foto" e "Remover foto".
- AC02.3 Item novo nasce Disponível e aparece no topo da busca.
- AC02.4 **Local onde foi encontrado** é texto livre, obrigatório, de 3 a 120 caracteres (com espaços aparados), com contador e exemplo; não há lista de locais (P42).
- AC02.5 **Categoria "Outros"**: só quando escolhida aparece o campo "Especifique a categoria" (obrigatório, 3 a 40 caracteres, ex.: "Crachá de visitante"). Ao trocar para outra categoria o campo some e seu valor e erro são descartados, e nunca se envia especificação com categoria predefinida. A especificação aparece junto da categoria como "Outros: {texto}" (P41).
- AC02.6 **"Onde está guardado agora?" é obrigatório** (aparado, 3 a 120 caracteres; vazio → "Informe onde o item está guardado.") no registro e na edição administrativa, com o texto auxiliar: "Informe onde o objeto está guardado. Essa informação é privada e só poderá ser acessada pela administração e pelo proprietário após a confirmação da posse." **Quem vê o valor** (regra única `canViewStoredAt`, imposta pelo serviço): a administração (detalhe, análise de reivindicação, edição, devoluções) e o usuário com reivindicação **aceita** nesse item **enquanto ele está Em reivindicação** (aguardando devolução), em "Guardado em" no detalhe, em "Minhas reivindicações" e na mensagem "Sua reivindicação foi aceita. Procure a administração para retirar o item. Ele está guardado em {local}." Depois da devolução volta a ficar oculto. Visitante, usuário comum, quem registrou o item (salvo se também tiver reivindicação aceita), reivindicante **pendente** ou **recusado** e reivindicante aceito de **outro** item não recebem o campo nem qualquer dica de que existe; as mensagens de pendente, recusada e devolvida nunca citam local (P43).

**RF03**
- AC03.1 Visitante (sem login) vê a lista e o detalhe dos itens, mas sem "onde está guardado", sem dados de reivindicação e sem quem registrou (P26); itens Devolvidos aparecem como "não encontrado".
- AC03.2 Itens Devolvidos não aparecem; Em reivindicação aparecem identificados.
- AC03.3 Filtros de categoria, local e período combinam entre si; "Limpar filtros". O filtro de **local é texto livre** ("contém", sem diferenciar maiúsculas nem acentos, até 120 caracteres) e aparece como chip "Local: …"; a categoria "Outros" filtra todos os itens "Outros", qualquer que seja a especificação.
- AC03.4 Ordenação: mais recentes primeiro.
- AC03.5 Sem resultado → estado vazio com ação de limpar filtros.

**RF04**
- AC04.1 Usuário comum (`role: user`) vê "É meu" em item Disponível/Em reivindicação, exceto se já tiver reivindicação ativa ou recusada naquele item, ou se o item já tiver uma reivindicação aceita (P14); o motivo é sempre explicado na tela.
- AC04.2 Enviar reivindicação muda item Disponível → Em reivindicação.
- AC04.3 Múltiplas reivindicações de usuários diferentes no mesmo item são permitidas.
- AC04.4 Administração vê e analisa reivindicações pendentes.
- AC04.5 Aceitar recusa automaticamente as demais; item permanece Em reivindicação.
- AC04.6 Recusar a última ativa devolve o item a Disponível.
- AC04.7 Usuário recusado vê status "Recusada" e não consegue reenviar.
- AC04.8 "Minhas reivindicações" reflete mudanças de status sem recarregar manualmente os dados.
- AC04.9 Aceitar uma reivindicação mantém o item Em reivindicação e libera o local de guarda **só** ao reivindicante aceito (AC02.6); recusar ou registrar a devolução o oculta de novo para ele. Reivindicante pendente ou recusado nunca o vê.

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
| P3 | Proposta cita "equipe de segurança/administração" | Um papel "Administração" (`admin`), criado por seed, por convite ou por promoção feita por outra administração (revisado em 27/10/2026; antes: só por seed) | [Recomendação] |
| P4 | Campo "onde está guardado agora" é hipótese a confirmar | Incluído no RF02; **obrigatório; privado à administração e ao reivindicante aceito (P43, revisto em 27/10/2026)** | [Recomendação] |
| P5 | Lista de categorias ainda sem valores reais | Valores demonstrativos dos exemplos do documento (o local é texto livre, P42) | [Premissa] |
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

| P21 | Sessão compartilhada entre abas quebraria a demonstração com duas abas (usuário + administração) | Sessão em `sessionStorage` (por aba, sobrevive a recarregar); dados em `localStorage` compartilhados | [Premissa] (revisão T03-a) |
| P22 | Item pode mostrar ao usuário comum o motivo de não poder reivindicar sem expor reivindicações de terceiros | O serviço devolve `viewer.{claim,edit,delete,registerReturn}` (decisões prontas) em `items.get`; a UI só exibe | decisão técnica (revisão T03-a) |
| P23 | Painel admin lista uma linha por item em reivindicação, mas o item pode ter várias reivindicações | A linha mostra a reivindicação aceita, se houver; senão a pendente mais antiga | [Premissa] (T08) |
| P24 | Após registrar um item, o enunciado manda ir ao detalhe; DESIGN §9.5 diz voltar à lista | Vai ao detalhe do item criado (`router.replace`) | [Premissa] (T06) |
| P25 | DESIGN §9.9 manda voltar ao painel após registrar devolução | Abre `/admin/devolucoes`, onde a devolução recém-registrada já aparece (fecha o fluxo da demo) | [Premissa] (QA, decisão do orquestrador) |
| P26 | Usuária pediu (22/10/2026) que qualquer pessoa possa ver os itens sem criar conta ou entrar; a recomendação anterior era exigir login (RF03) e alertava que a busca pública expõe fotos e dados | Lista e detalhe públicos para visitantes. Não aparecem ao visitante: "onde está guardado" e qualquer dado de reivindicação. Reivindicar, registrar item e demais telas continuam exigindo login (visitante vai para `/entrar` e volta ao item depois de entrar). Devolvidos continuam ocultos | **Decisão da usuária** (22/10/2026), ainda não confirmada pela equipe nem pelo professor |
| P27 | Seed sem fotos deixava a lista sem imagem | Os itens do seed ganham imagens ilustrativas originais (SVG em `frontend/public/seed/`), identificáveis como demonstrativas; 9 dos 11 itens agora usam fotos reais da equipe (`.webp`; "Carteira de estudante" foi trocada por "Boné bege") e 2 seguem ilustrações (`mochila.svg`, `carregador.svg`); todos mantêm o rótulo "Imagem ilustrativa". Observação: as fotos mostram marcas visíveis em 3 itens (boné, casaco, notebook); autoria/licença a registrar em `FOTOS.md`. Itens criados pelo usuário continuam com foto enviada (data URL) | [Premissa] (substitui parte de P20) |
| P28 | Depois de entrar ou criar conta a partir do detalhe de um item, a pessoa deveria voltar ao item | `/entrar` e `/cadastro` aceitam `?next=/itens/{id}` (regex própria, somente esse formato; `/itens` com filtros **não** é aceito); sem `next`, vale a página inicial do papel | [Premissa] (22/10/2026) |
| P29 | Login por e-mail e senha (a usuária pediu em 22/10/2026) num protótipo sem backend | Senha guardada só como hash PBKDF2-SHA-256 com sal, em registro separado do usuário, no navegador. As contas `@demo.test` do seed usam a senha de demonstração `demonstracao123`; os perfis de um toque entram sem digitar. **Atualizado em 25/10/2026:** a política de senha do cadastro passou a ser a de P33 (mín. 10 caracteres; antes 8); o hash PBKDF2 vale só para o protótipo sem backend, no backend vale bcrypt (P31). Erro único para e-mail inexistente ou senha errada. Isto **não é segurança real**: a proteção de verdade depende do backend | **Decisão da usuária** (login por senha); detalhes [Premissa] |
| P30 | Login com Google institucional (pedido em 22/10/2026) | Botão do Google Identity Services; o ID token é verificado em uma rota de servidor do Next (`/api/auth/google`) e só e-mails do domínio permitido entram. **Atualizado em 25/10/2026:** e-mail de domínio não institucional deixou de ser recusado e cria conta com vínculo `external` (P32, P40, AC01.12); a verificação do ID token no servidor continua. Domínio padrão `undb.edu.br` é **HIPÓTESE** (pessoas da instituição podem usar subdomínios; aceitamos o domínio e seus subdomínios) e é configurável por `NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS` (frontend) e `GOOGLE_ALLOWED_DOMAINS` (backend). **Atualizado em 27/10/2026:** o domínio só define o vínculo (P40); conta nova pelo Google só aceita os termos, sem escolher papel. Precisa de um Client ID do Google (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`); sem ele o botão não aparece. Conta criada pelo Google não tem senha. Com o FastAPI, a verificação do token passa para o backend | **Decisão da usuária**; domínio e tratamento do vínculo são [Premissa] |
| P31 | O protótipo era só frontend; o enunciado pede a stack FastAPI + SQLite, e o frontend precisa trocar mock → API | Backend em `backend/` (FastAPI + SQLite via SQLAlchemy, `create_all` sem migrações) que reproduz os serviços do mock: login por senha com bcrypt, sessão por JWT (HS256, `Authorization: Bearer`; **substituída em 25/10/2026 por cookie HttpOnly + refresh rotativo via proxy, P34**), Google verificado no servidor (`tokeninfo`) com o mesmo domínio configurável, fotos gravadas em disco (`backend/uploads/`, servidas em `/uploads/*`, campo `photoUrl`), seed com os mesmos ids do mock e rotas `/demo/*` só com `DEMO_MODE=true`. Contrato em `docs/api/API.md`. Acrescentado em 25/10/2026: 2FA, convites, auditoria, confirmação de e-mail, recuperação de senha e bloqueio progressivo (P32–P38). **Hospedagem serverless (ex.: Vercel) não persiste o arquivo SQLite nem as fotos** (disco efêmero): em produção é preciso um host com disco persistente ou trocar o banco/armazenamento de fotos. **Hipótese a decidir pela equipe** | [Premissa] (a decidir pela equipe) |
| P32 | Pessoas sem vínculo com a UNDB (ex.: quem visita o campus) também precisam usar o sistema | **Revisada em 27/10/2026.** O papel "comunidade externa" (`external` como papel) e a escolha aluno/professor/externa no cadastro foram **removidos**. Qualquer pessoa pode se cadastrar como usuário comum (`role: user`), com as mesmas permissões; a diferença entre vínculo institucional e externo é só o campo `affiliation` (P40), que não dá nem tira permissão. Versão de 25/10/2026 (superada): papel `external` autodeclarado | [Premissa] (25/10/2026, revisada em 27/10/2026), a validar pela equipe e pelo professor |
| P33 | Política de senha | Mín. 10 caracteres, máx. 72 **bytes** (limite técnico do bcrypt; a interface **não fala em bytes**: mostra "Use pelo menos 10 caracteres. Evite senhas comuns." e "A senha é longa demais. Use uma senha mais curta."; emojis e acentos ocupam mais de 1 byte), fora de uma lista de senhas comuns. Sem exigência de maiúsculas/símbolos. A lista de comuns é curta e embutida (não cobre todos os casos) | [Premissa] (25/10/2026) |
| P34 | Sessão por token no `Authorization` fica acessível a scripts do navegador | No backend, sessão por **cookie HttpOnly** + refresh rotativo; o frontend (Next) repassa as chamadas por um **proxy no mesmo domínio**, para o cookie não depender de CORS. O protótipo só com mocks continua com `sessionStorage` (P21). Exige que frontend e API sejam hospedados de modo compatível com esse proxy | [Premissa] (25/10/2026) |
| P35 | Administração é o perfil de maior risco (aprova devoluções) | **2FA TOTP obrigatório** para administração, exceto no modo demonstração. Sem QR code (segredo manual + link `otpauth`), para não adicionar dependência. Sem códigos de recuperação definidos: perda do app depende de outra administração ou de intervenção manual **[Ponto ainda não definido]** | [Premissa] (25/10/2026) |
| P36 | LGPD: termos, privacidade, exportar e excluir | Aceite de termos no cadastro, exportação e exclusão dos próprios dados. Os textos de **termos e `/privacidade` são texto-modelo com lacunas**, **sem validação jurídica** nem de encarregado/controlador; não podem ser tratados como definitivos. Base legal, prazos de retenção e contato do encarregado: **[Ponto ainda não definido]** | [Premissa] (25/10/2026) |
| P37 | Confirmação de e-mail, recuperação de senha, Google e Turnstile dependem de serviços externos | E-mail confirmado é pré-requisito para registrar item e reivindicar (conta Google com e-mail verificado já nasce confirmada). Turnstile é opcional (sem chave, o formulário funciona). **NÃO testado de verdade:** envio real de e-mail, login Google real e captcha real; só testes automatizados com simulações (ou nada, onde for dito). A validar antes de qualquer apresentação que os cite como funcionando | [Premissa] (25/10/2026); **não testado** |
| P38 | Bloqueio progressivo, auditoria, gestão de usuários e convites de administração | Limites e tempos de bloqueio, validade de convites e de links, e retenção da auditoria são **[Ponto ainda não definido]**; os critérios AC01.14 a AC01.18 fixam o comportamento, não os números. Tentativas ficam registradas no banco (não em memória) | [Premissa] (25/10/2026) |
| P39 | Onde hospedar a API (SQLite e fotos em disco) | **Em aberto.** Segue valendo o alerta de P31: serverless não persiste disco. Nenhuma hospedagem foi escolhida, testada ou contratada | [Ponto ainda não definido] |

Detalhes de implementação do domínio (códigos de erro, `subscribe`, chaves de storage, opções de teste) ficam documentados no código de `frontend/src/services/` e `frontend/src/lib/rules/`.
| P40 | O cadastro pedia que a pessoa se declarasse aluno, professor ou externa, o que não é verificável (não há integração com a UNDB nem matrícula) e induzia confiança indevida | **Vínculo = domínio do e-mail; autodeclaração removida; não verificado.** `affiliation` = `institutional` se o domínio do e-mail for um dos configurados (`GOOGLE_ALLOWED_DOMAINS` / `NEXT_PUBLIC_GOOGLE_ALLOWED_DOMAINS`, padrão `undb.edu.br` = **hipótese**) ou subdomínio dele (`evilundb.edu.br` e `undb.edu.br.evil.com` não contam); caso contrário, `external`. Calculado só pelo texto do e-mail, no cadastro por senha e no Google. Não concede permissão; serve para exibição e filtro da administração. Verificar de fato o vínculo exigiria integração com a UNDB (ver backlog, seção 10). Contas anteriores: migração Alembic 0003 converte `student`/`teacher`/`external` em `user` com vínculo `institutional`/`external`; no mock, `DB_VERSION` 6 descarta os dados antigos do `localStorage` | [Premissa] (27/10/2026), a validar pela equipe e pelo professor |
| P41 | O pedido era uma categoria "Outro" com especificação; a lista já tem "Outros" | **Reaproveitar "Outros"** como a opção "Outro", em vez de criar uma categoria nova. Com "Outros", "Especifique a categoria" é obrigatório (3 a 40 caracteres); exibição "Outros: {texto}"; o filtro continua por "Outros" | [Premissa] (27/10/2026) |
| P42 | Lista fixa de locais não representa o campus real e a equipe não definiu a lista | **Local onde foi encontrado = texto livre** (3 a 120 caracteres). Filtro de local por texto "contém" (sem caixa nem acentos, até 120). Locais do seed são só exemplos; nenhum local real do campus foi inventado | [Premissa] (27/10/2026) |
| P43 | O local de guarda precisa ser conhecido da administração para a retirada, mas não pode ser exposto a quem não deveria ver; versão anterior (opcional e só administração) deixava o dono sem saber onde retirar | **`storedAt` obrigatório** (3–120). **Visível à administração e ao usuário com reivindicação aceita nesse item enquanto ele está Em reivindicação (aguardando devolução).** O mock (`services/mock/viewer.ts`, via `canViewStoredAt` de `lib/rules`) e o backend impõem a regra; a UI não decide. **Fluxo de devolução existente reutilizado: sem estados novos e sem verificação de identidade além da análise da administração.** O protótipo **não** integra com a instituição | [Premissa] (27/10/2026), a validar pela equipe e pelo professor |

## 10. Backlog de evolução (não implementado)

Itens abaixo são **[Recomendação]**, fora do escopo atual e sem decisão da equipe:

- **Solicitar acesso administrativo.** Em vez de depender só de convite ou de `create_admin`, o usuário comum poderia pedir acesso de administração com uma justificativa; um responsável (administração existente) aprovaria ou recusaria, com registro na auditoria. Hoje isso não existe: nenhuma rota de cadastro cria administração.
- **Verificação real do vínculo institucional.** Comprovar que a pessoa é da UNDB (e não só que o e-mail tem o domínio) exigiria integração com a UNDB (login institucional ou consulta de vínculo). Sem isso, `affiliation` continua sendo uma informação **não verificada**.
