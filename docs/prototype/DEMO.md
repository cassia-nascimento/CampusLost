# Roteiro de demonstração — protótipo de frontend do CampusLost

> **O que é isto:** protótipo navegável **sem backend**. Dados, "login" e regras rodam no navegador (mocks + `localStorage`). Isso **não** é segurança real (RNF01 é apenas simulado e rotulado como tal na interface; a segurança real depende do backend futuro).
> **Status das regras:** as regras de negócio usadas aqui vêm do documento de decisões como **[Recomendação] pendente**, adotadas como **premissas** do protótipo (SPEC §9). Não são decisões aprovadas pela equipe nem pelo professor.

## 1. Preparar (uma vez)

```bash
cd frontend
npm install
npm run build && npm run start      # ou: npm run dev   → http://localhost:3000
```

Abra `http://localhost:3000` (a raiz redireciona para `/entrar` ou `/itens`). Para a demonstração na sala, prefira o celular ou a janela do navegador estreita (**360 px**) para mostrar o RNF02, e depois a janela larga.

**Regra de ouro:** a sessão é **por aba** (premissa P21), mas os dados são compartilhados. Use **duas abas** lado a lado: **Aba A** = aluna/professor, **Aba B** = administração. A Aba B atualiza sozinha quando a Aba A age (sincronização por `storage`).

**Antes de cada apresentação:** na tela de entrada, use **Reiniciar demonstração** (restaura os dados de exemplo e encerra a sessão).

## 2. Perfis de demonstração (tela `/entrar`)

| Perfil | Como entrar | Pode |
|---|---|---|
| Aluna (Marina Alves) | botão do perfil **Aluno** | registrar item, reivindicar, ver suas reivindicações |
| Professor (Rafael Lima) | botão do perfil **Professor** | o mesmo que o aluno |
| Administração | botão do perfil **Administração** | analisar reivindicações, editar/excluir itens, registrar devolução, ver devoluções |

Também é possível **criar conta** em `/cadastro` (sem senha; o papel escolhido não é verificado — aviso exibido na tela). Todos os usuários, itens, categorias e locais são **fictícios/demonstrativos**.

## 3. Roteiro principal (≈ 6 min): o ciclo completo

1. **Aba A — Aluna:** entrar como **Aluno**. Em `/itens`, mostrar a lista e combinar filtros (categoria + local + período); a URL guarda a busca. No celular, mostrar o botão **Filtros** (folha inferior).
2. **Aba A:** **Registrar item** (`/itens/novo`) com título, descrição, categoria, local, data e foto (a foto é reduzida automaticamente no navegador). Mostrar um erro de validação (enviar vazio → foco no primeiro campo com erro). Após salvar, o app abre o detalhe do item novo, com status **Disponível**.
3. **Aba A — trocar de pessoa:** **Sair** pelo menu da conta e entrar como **Professor**. Abrir o item recém-registrado e clicar **É meu**; responder as duas perguntas de verificação e **Enviar reivindicação**. O item passa a **Em reivindicação**. Em **Minhas reivindicações**, a reivindicação aparece como **Pendente**.
4. **Aba B — Administração:** entrar como **Administração**. O painel `/admin` lista o item com reivindicação pendente. Abrir **Analisar**, conferir as respostas e **Aceitar**. O selo vira **Aceita** na hora e surge **Registrar devolução**.
5. **Aba B:** **Registrar devolução** (confirmar no diálogo). O app abre `/admin/devolucoes`, onde a devolução já aparece; mostrar o filtro por período.
6. **Aba A (Professor):** em **Minhas reivindicações** a situação aparece como **Aceita/Item devolvido** (atualiza sem recarregar). Em `/itens` o item **não aparece mais** (devolvido sai da busca) e, aberto pelo link, é **somente leitura**.

## 4. Fluxos alternativos (escolha 1–2 conforme o tempo)

- **Recusar:** na análise, **Recusar** a **última** reivindicação ativa → o item volta a **Disponível**; a pessoa vê "Reivindicação recusada" e **não pode reenviar** para o mesmo item.
- **Duas reivindicações no mesmo item:** aceitar uma **recusa automaticamente** a outra.
- **Editar/excluir (admin):** `/admin/itens/[id]/editar`. Excluir pede confirmação e informa quantas reivindicações serão removidas junto.
- **Permissões:** com a aluna, tentar abrir `/admin` → **Acesso restrito**. O administrador **não reivindica** itens (premissa P8).
- **Voltar no celular:** de Minhas reivindicações → item → voltar retorna à lista de origem; da busca com filtros, o voltar preserva os filtros.

## 5. Limitações a declarar com honestidade

- Sem backend: não há senha, e-mail, notificação ou segurança real; dados ficam só no navegador (limite de armazenamento; ao atingir, o app avisa e mantém o que foi digitado).
- Excluir um item remove **sem aviso** a reivindicação pendente de quem a fez (premissa P18).
- Categorias e locais são **dados demonstrativos**; a lista real do campus ainda não foi definida.
- Premissas **P8–P10 e P14–P25** (SPEC §9) aguardam confirmação da equipe/professor.
- Verificado em Chromium; Safari, Firefox, leitor de tela e dispositivos reais **não** foram testados (ver `docs/prototype/qa/RELATORIO-QA.md`).
- Trello e Figma ainda não foram sincronizados com este protótipo.

## 6. Se algo der errado ao vivo

- Tela estranha ou dados confusos → **Sair** e **Reiniciar demonstração** em `/entrar`.
- Aba B não atualizou → recarregar (os dados estão no `localStorage`, nada se perde).
- Navegador em modo privado/sem armazenamento → o app avisa que os dados não serão guardados; o fluxo funciona, mas perde-se ao recarregar.
