# Roteiro de demonstração — protótipo de frontend do CampusLost

> **O que é isto:** protótipo navegável **sem backend**. Dados, "login" e regras rodam no navegador (mocks + `localStorage`). Isso **não** é segurança real (RNF01 é apenas simulado e rotulado como tal na interface; a segurança real depende do backend futuro).
> **Status das regras:** as regras de negócio usadas aqui vêm do documento de decisões como **[Recomendação] pendente**, adotadas como **premissas** do protótipo (SPEC §9). Não são decisões aprovadas pela equipe nem pelo professor.
> **Validação deste roteiro:** os passos da seção 3 foram percorridos no navegador (Chromium) a 390 px e a 1280 px, e os textos entre aspas abaixo são os que a tela mostrou. Os fluxos da seção 4 estão cobertos pelo script de QA `e2e-flow` (ver `docs/prototype/qa/RELATORIO-QA.md`), não por uma releitura manual passo a passo.

## 1. Preparar (uma vez)

```bash
cd frontend
npm install
npm run build && npm run start      # ou: npm run dev   → http://localhost:3000
```

Abra `http://localhost:3000` (a raiz redireciona para `/entrar` ou `/itens`). Para a demonstração na sala, prefira o celular ou a janela do navegador estreita (**360 px**) para mostrar o RNF02, e depois a janela larga.

**Regra de ouro:** a sessão é **por aba** (premissa P21), mas os dados são compartilhados entre as abas do mesmo navegador. Use **duas abas** lado a lado: **Aba A** = usuário comum, **Aba B** = administração. A Aba A atualiza sozinha quando a Aba B age (sincronização por `storage`).

**Antes de cada apresentação:** entre com qualquer perfil e, no **Menu da conta**, use **Reiniciar demonstração** (pergunta "Reiniciar a demonstração?"; confirme em **Reiniciar**). Isso restaura os dados de exemplo e encerra a sessão. O comando não existe mais na tela `/entrar`.

## 2. Perfis de demonstração (tela `/entrar`)

Na tela de entrada há **dois** botões de um toque, sem título visível e sem digitar senha. Todas as contas `@demo.test` também entram por e-mail e pela senha de demonstração `demonstracao123` (a tela não a exibe), ex.: `marina@demo.test`, `externo@demo.test`:

| Botão na tela | Quem é | Pode |
|---|---|---|
| **Usuário** (Marina Alves) | `user`, vínculo `institutional` | registrar item, reivindicar, ver suas reivindicações |
| *(sem botão)* `externo@demo.test` (Camila Torres) | `user`, vínculo `external` | o mesmo que o Usuário (o vínculo não muda permissões); entra por e-mail e senha |
| **Administração** | `admin` | analisar reivindicações, editar/excluir itens, registrar devolução, ver devoluções |

Também é possível **criar conta** em `/cadastro` (nome, e-mail, senha de pelo menos 10 caracteres (a tela diz "Use pelo menos 10 caracteres. Evite senhas comuns."; o limite técnico de 72 bytes do bcrypt existe, mas a interface não fala em bytes) e aceite dos termos; **não há escolha de papel**). O vínculo institucional ou externo sai só do domínio do e-mail (padrão `undb.edu.br`, **hipótese**) e **não é verificado**; não há integração com a UNDB (P40). Nenhuma tela de cadastro cria administração. "Entrar com Google" depende de o Client ID do Google estar configurado; em conta nova só se aceitam os termos. Confirmação de e-mail, 2FA da administração, convites e auditoria existem só no backend (SPEC AC01.8 a AC01.22) e **não** fazem parte do roteiro desta demo sem backend; envio real de e-mail, Google real e captcha **não foram testados** (P37). Todos os usuários, itens, categorias e locais de exemplo são **fictícios/demonstrativos**.

## 3. Roteiro principal (≈ 6 min): o ciclo completo

1. **Aba A — Usuário institucional:** clicar em **Usuário**. O app abre `/itens` ("Itens encontrados", 9 itens no estado inicial). No celular, o botão **Filtros** abre uma folha com **Categoria**, **Local**, **Encontrado de** e **Encontrado até**; no desktop os campos ficam em linha. O **Local** é um campo de texto (ex.: "biblioteca"; busca por trecho, sem diferenciar acentos). Combinar categoria + local; a URL guarda a busca.
2. **Aba A:** **Registrar item** (`/itens/novo`). Primeiro clicar em **Registrar item** com o formulário vazio para mostrar os erros ("Informe um título.", "Informe uma descrição.", "Escolha uma categoria.", "Informe o local onde foi encontrado.", "Informe onde o item está guardado.") e o foco indo ao primeiro campo. Depois preencher **O que foi encontrado?**, **Descrição**, **Categoria** (ao escolher **Outros** aparece **Especifique a categoria**; ao trocar de categoria o campo some), **Onde foi encontrado?** (texto livre) e **Onde está guardado agora?** (obrigatório; o texto auxiliar explica que é privado: só a administração e o proprietário, após a confirmação da posse, veem; sem preencher aparece "Informe onde o item está guardado."). A foto é opcional: **Enviar foto** escolhe um arquivo e **Tirar foto** abre a câmera no celular (no computador cai num seletor de arquivo); a foto é reduzida automaticamente no navegador. Salvar. Aparece o aviso "Item registrado. Ele já aparece na busca." e o detalhe do item novo, com o status **Disponível** ("Pode ser reivindicado.").
3. **Aba A — trocar de pessoa:** **Menu da conta → Sair**, e entrar como outra pessoa pelo formulário: `externo@demo.test` com a senha `demonstracao123` (Camila Torres, para reivindicar o item que a Marina registrou). Abrir o item recém-registrado (pela busca) e clicar **É meu** (tela "Reivindicar item"); responder **Que detalhes só o dono saberia?** e **Onde e quando você perdeu?** e clicar **Enviar reivindicação**. Aparece "Reivindicação enviada. A administração vai analisar." e o app abre **Minhas reivindicações**, onde a reivindicação está **Pendente** ("Aguardando análise da administração."), **sem** o local de guarda. O item agora está **Em reivindicação**.
4. **Aba B — Administração:** clicar em **Administração**. O painel `/admin` mostra contadores (Pendentes, Para devolver, Devoluções), a lista **Aguardando devolução** (só itens já aceitos, como o notebook da Marina; itens só com pendentes não aparecem ali) e uma fila de reivindicações pendentes **que já inclui outras do estado inicial**: procure a linha do item novo (**Camila Torres**, "Enviada hoje") e clique em **Analisar**. Na tela "Analisar reivindicação" conferir as respostas e clicar **Aceitar** → diálogo "Aceitar esta reivindicação?" ("O item continua Em reivindicação até você registrar a devolução.") → **Aceitar reivindicação**. Aparece "Reivindicação aceita." (no painel, o item passa da fila para **Aguardando devolução**). O selo vira **Aceita** e surge o botão **Registrar devolução**. (Se quiser mostrar a regra de privacidade: na aba A, **Minhas reivindicações** passa a mostrar "Ele está guardado em {local}" e o detalhe do item ganha a linha **Guardado em**; um usuário comum sem reivindicação aceita e o visitante continuam sem ela.)
5. **Aba B:** **Registrar devolução** → diálogo "Registrar a devolução?" ("Entregue a: Camila Torres. Esta ação não pode ser desfeita.") → **Registrar devolução**. Aparece "Devolução registrada. O item saiu da busca." (ao voltar ao painel, o item some de **Aguardando devolução**) e o app abre `/admin/devolucoes`, onde a devolução já está listada (os campos **Devolvido de** / **até** filtram por período).
6. **Aba A (usuário externo):** em **Minhas reivindicações**, a reivindicação passa a **Aceita · Item: Devolvido** sem recarregar (a tela anuncia "Status atualizado: Aceita (…)"). O item **não aparece mais** em `/itens`; aberto pelo link, mostra "Item devolvido — Este item já foi devolvido. Ele não aparece mais na busca e fica somente para leitura." e "Sua reivindicação foi aceita e a devolução foi registrada."

## 4. Fluxos alternativos (escolha 1–2 conforme o tempo)

- **Recusar:** na análise, **Recusar** a **última** reivindicação ativa → o item volta a **Disponível**; a pessoa vê a reivindicação como recusada e **não pode reenviar** para o mesmo item.
- **Duas reivindicações no mesmo item:** aceitar uma **recusa automaticamente** a outra. (No estado inicial, `Chaveiro com três chaves` já tem duas pendentes.)
- **Várias reivindicações na análise:** como Administração, abrir o item `Chaveiro com três chaves` (duas pendentes), **Analisar** uma delas e usar **Próxima**/**Anterior** ou a lista "Reivindicações deste item" para alternar sem voltar ao item. Aceitar uma: as outras aparecem como **Recusada** na lista, sem recarregar. A partir de 768 px, o link **Voltar ao item** (ou **Voltar ao painel**, se abriu pelo painel) aparece acima do título; no celular a seta do header faz o mesmo.
- **Editar/excluir (admin):** no detalhe do item, **Editar**; na edição há **Excluir item**, que pede confirmação e informa quantas reivindicações serão removidas junto.
- **Permissões:** com qualquer usuário comum (institucional ou externo), abrir `/admin` → **Acesso restrito**. A administração **não vê "É meu"** (não reivindica; premissa P8). Quem registrou um item também **não vê "É meu"** nele e lê "Você registrou este item, então não pode reivindicá-lo…" (premissa P46); no seed, Rafael registrou `Fones de ouvido sem fio`.
- **Voltar no celular:** de **Minhas reivindicações** → **Ver item** → voltar retorna a **Minhas reivindicações**; da busca com filtros, o voltar preserva os filtros.

## 5. Limitações a declarar com honestidade

- Sem backend: a senha e o login com Google não são segurança real do sistema final, e não há envio de e-mail nem notificação; os dados ficam só no navegador (há limite de armazenamento; ao atingir, o app avisa e mantém o que foi digitado). Se o navegador bloquear o armazenamento (modo privado, por exemplo), aparece um aviso na faixa de demonstração e os dados se perdem ao recarregar.
- Excluir um item remove **sem aviso** a reivindicação pendente de quem a fez (premissa P18).
- O vínculo "institucional" ou "externo" vem só do domínio do e-mail e **não é verificado**: os perfis de demonstração e `externo@demo.test` usam `@demo.test` e têm o vínculo gravado à mão no seed. Os dados antigos do navegador são descartados na primeira abertura após a mudança de modelo (`DB_VERSION` 6).
- As categorias são **dados demonstrativos**; a lista real ainda não foi definida. O local onde o item foi encontrado é texto livre e os do seed são só exemplos. O local de guarda é obrigatório e privado: visível à administração e ao usuário cuja reivindicação foi **aceita** (enquanto o item aguarda devolução); a retirada segue o fluxo de devolução existente, sem verificação de identidade além da análise da administração. A câmera (**Tirar foto**) depende do navegador/aparelho.
- As ações levam de 300 a 600 ms de latência **simulada**; o envio de uma reivindicação encadeia várias operações e leva cerca de 2 s (medido). Avise a plateia para não parecer travamento.
- Após navegar entre telas, o foco do teclado volta ao início da página (existe o link "Pular para o conteúdo"). É uma limitação de acessibilidade conhecida, não corrigida.
- A faixa de demonstração ocupa cerca de 78 px (3 linhas) no celular.
- Premissas **P8–P10, P14–P25, P40 e P46** (SPEC §9) aguardam confirmação da equipe/professor.
- Verificado em Chromium; Safari, Firefox, leitor de tela e dispositivos reais **não** foram testados (ver `docs/prototype/qa/RELATORIO-QA.md`).
- Trello e Figma ainda não foram sincronizados com este protótipo.

## 6. Se algo der errado ao vivo

- Tela estranha ou dados confusos → **Menu da conta → Reiniciar demonstração** (ou **Sair** e entrar de novo).
- Aba B não atualizou → recarregar (os dados estão no `localStorage`, nada se perde).
- Navegador em modo privado/sem armazenamento → o app avisa; o fluxo funciona, mas perde-se ao recarregar.
