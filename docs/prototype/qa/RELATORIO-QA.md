# Relatório de QA — CampusLost (protótipo de frontend)

> **Nota (20/10/2026):** este relatório registra o estado em que o QA foi feito. Depois dele, banner, rodapé e aviso de demonstração em `/entrar` e o botão "Reiniciar demonstração" da tela de entrada foram removidos por decisão da usuária; os itens abaixo que os citam (AC01.6, D12 etc.) refletem o estado anterior.

Papel: `qa-a11y`. Data da execução: 19/10/2026. Base: branch `feature/prototipo-frontend` no commit `1332804` (worktree do agente, nenhum arquivo de produto alterado).
Ambiente: `npm run build && npx next start -p 3110` (Next 16.4.0), Chromium headless 1194 via `playwright-core` 1.64, `axe-core` 4.14. Ferramentas instaladas fora do repositório; os scripts estão em `docs/prototype/qa/scripts/`.
Premissas de leitura: regras de negócio são **[Recomendação] pendente** e premissas P1–P24 (SPEC §9); este relatório testa o protótipo contra a SPEC, não valida as regras.

---

## 1. Resumo executivo

**Veredito para a demonstração: APROVADO COM RESSALVAS.**

- Nenhum defeito **Bloqueia demo** e nenhum **Alta**. O fluxo completo (cadastro, registro de item com e sem foto, reivindicação por dois usuários, análise, aceite, devolução, histórico) funcionou de ponta a ponta, sem erros de console em nenhum perfil.
- Os cinco itens que os desenvolvedores declararam **não verificados** foram verificados no navegador real e funcionam: redimensionamento de foto por canvas, sincronização entre abas por evento `storage`, estados de erro com "Tentar novamente", "Reiniciar demonstração" e localStorage indisponível (este último sem quebra, mas sem aviso ao usuário: D9).
- Comandos de qualidade: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm run test` 18 arquivos / 215 testes passando; `npm run build` OK com 13 rotas.
- axe-core em cerca de 91 estados (390 e 1280 px): **0 violações críticas ou sérias, 0 de contraste**. Só restam achados moderados (D6).
- Ressalvas principais, a corrigir antes de uma demonstração com dados reais digitados por terceiros:
  - **D1 (Média):** título longo sem espaços estoura a lista `/itens` no celular (rolagem horizontal de página inteira).
  - **D2 (Média, a11y):** o botão "Adicionar/Trocar foto" tem nome acessível "Foto (opcional)".
  - Demais defeitos são **Baixa** (D3–D12).
- Com os dados do seed e entradas de tamanho normal, não há rolagem horizontal em 360, 390, 768 e 1280 px. Em 320 px só `/admin` transborda 10 px (D4; a SPEC exige 360 px).

Contagem de defeitos: Bloqueia demo 0 · Alta 0 · Média 2 · Baixa 10.

---

## 2. Matriz de critérios de aceite (SPEC §7)

Legenda: OK / FALHA / NÃO TESTADO. "Script" = arquivo em `docs/prototype/qa/scripts/`. Perfis: anon, Marina (aluna), Rafael (professor), Admin; "Camila" é usuária criada no fluxo.

| AC | Resultado | Evidência |
|---|---|---|
| AC01.1 Cadastro (nome, e-mail, papel; e-mail duplicado) | OK | `e2e-flow.mjs` AC01.1a; `forms.mjs` AC01.1b–g: vazio mostra 3 erros com foco no primeiro; nome só com espaços e de 1 caractere rejeitados; e-mail duplicado (inclusive variante em maiúsculas) mostra erro; "Administração" não é oferecido como papel; duplo clique cria 1 usuário. 390 px. |
| AC01.2 Login por e-mail; inexistente mostra erro | OK | `e2e-flow.mjs` AC01.2a; `forms.mjs` AC01.2b (erro claro, texto mantido), AC01.2c (e-mail com maiúsculas e espaços entra). |
| AC01.3 Três perfis entram com um toque | OK | `lib.mjs demoLogin` usado nos 3 papéis em todos os scripts; `keyboard.mjs` AC01.3-kb-login (login só por teclado). |
| AC01.4 Sessão persiste; sair encerra | OK | `e2e-flow.mjs` AC01.4a/b; sessão em `sessionStorage` por aba (`storage.mjs` RNF-sync-sessao: sair numa aba não derruba as outras). |
| AC01.5 Rotas privadas → `/entrar`; `/admin/**` negado a aluno/professor | OK | `permissions.mjs`: 15 rotas × anon/aluno/professor/admin. Anônimo vai a `/entrar`; aluno e professor veem "Acesso restrito" (texto definido no DESIGN §935); logado em `/entrar` ou `/cadastro` é redirecionado. Ver D11 sobre o título da aba. |
| AC01.6 Aviso de segurança simulada visível | OK | Faixa "Demonstração: login simulado e dados salvos só neste navegador." em todas as telas (`a11y.mjs`, capturas em `shots/`); aviso completo em `/entrar` e no rodapé desktop; "Não pedimos senha nesta demonstração." Ver D12 sobre rotulagem de dados fictícios. |
| AC02.1 Registro com todos os campos; data não futura | OK | `e2e-flow.mjs` AC02.1a/b/c; `forms.mjs` AC08.1-item-vazio (5 erros, foco no primeiro), AC02.1-futura (data futura bloqueada). |
| AC02.2 Foto opcional, limite, formato, pré-visualização | OK (ressalva D2) | `forms.mjs` AC02.2-gif (GIF recusado), AC02.2-grande (PNG > 10 MB recusado), AC02.2-falso (ver §4); pré-visualização exibida (`probe` com `img[alt^="Pré-visualização"]`). O check `AC02.2-preview` em `forms.mjs` aparece como FALHA no JSON porque procura o botão pelo nome "Trocar foto", que o D2 impede; é consequência do D2, não da pré-visualização. `photo.mjs` PHOTO-1..7. |
| AC02.3 Item novo nasce Disponível e aparece no topo | OK | `e2e-flow.mjs` AC02.1/2/3a e AC02.3b. |
| AC03.1 Busca exige login | OK | `search.mjs` AC03.3f (anônimo com URL filtrada vai a `/entrar`); `permissions.mjs`. |
| AC03.2 Devolvidos ocultos; "Em reivindicação" identificado | OK | `search.mjs` AC03.2b, AC03.2c; `e2e-flow.mjs` AC03.2a (item some da busca após devolução). |
| AC03.3 Filtros combinam; "Limpar filtros" | OK | `search.mjs` AC03.3a–e (categoria, local, período inclusivo, combinados), AC03.5a (limpar), AC03.3e (URL compartilhável restaurada em contexto novo), AC03.x-voltar, AC03.x-hist (`router.replace`, sem empilhar histórico), AC03.x-invalid (parâmetros inválidos ignorados), AC03.x-periodo-invertido (erro visível). Sheet no celular (360 px): AC03.3g/h/i, AC08.1-sheet-esc. |
| AC03.4 Mais recentes primeiro | OK | `search.mjs` AC03.4a. |
| AC03.5 Sem resultado → estado vazio com limpar | OK | `search.mjs` AC03.5a; captura `search-sem-resultados-1280.png`. |
| AC04.1 "É meu" e motivos explicados | OK | `e2e-flow.mjs` AC04.1a, AC04.2b (professor com reivindicação pendente não vê o botão e vê o motivo), AC04.7a/b (recusado não reenvia: rota e botão), P14; `rules.mjs` P14-bloqueio-novas, ADM-nao-reivindica, P8 (dono pode reivindicar: comportamento da premissa P8). |
| AC04.2 Enviar muda Disponível → Em reivindicação | OK | `e2e-flow.mjs` AC04.2/04.3a. |
| AC04.3 Múltiplas reivindicações de usuários diferentes | OK | `e2e-flow.mjs` AC04.3b, AC04.3c. |
| AC04.4 Administração vê e analisa pendentes | OK | `e2e-flow.mjs` AC04.4a/b; captura `flow-admin-analise-1280.png`. |
| AC04.5 Aceitar recusa as demais; item permanece Em reivindicação | OK | `e2e-flow.mjs` AC04.5a. |
| AC04.6 Recusar a última ativa devolve a Disponível | OK | `e2e-flow.mjs` AC04.6a; `rules.mjs` AC04.6-parcial (item com 2 pendentes: Em reivindicação → Em reivindicação → Disponível). |
| AC04.7 Recusado vê "Recusada" e não reenvia | OK | `e2e-flow.mjs` AC04.7a/b/8a; `rules.mjs` AC04.7c. |
| AC04.8 "Minhas reivindicações" reflete mudanças sem recarregar | OK | `storage.mjs` AC04.8-sync-user e `misc.mjs` AC04.8-sync-sem-reload (marcador `window.__m` preservado = sem reload; região viva anuncia "Status atualizado: Aceita (Calculadora científica)."); `e2e-flow.mjs` AC04.8a/b. |
| AC05.1 Só admin vê "Registrar devolução", e só com aceita | OK | `e2e-flow.mjs` AC05.1a; `rules.mjs` RF05-sem-aceita (botão ausente com só pendentes). |
| AC05.2 Confirmação; item Devolvido, some da busca, aparece em `/admin/devolucoes` | OK | `e2e-flow.mjs` AC05.2a/b, AC03.2a. Ver observação I2 (redireciona a `/admin/devolucoes`, o DESIGN §9.9 diz "volta ao painel"). |
| AC05.3 Devoluções filtram por período; sem exportar | OK | `e2e-flow.mjs` AC05.3a (hoje, e intervalo vazio), AC05.3b. |
| AC06.1 Só admin edita/exclui; exclusão com confirmação; Devolvido imutável | OK | `e2e-flow.mjs` AC06.1a (sem editar/excluir; `/editar` bloqueado), P18/AC06.1b (exclusão remove item e reivindicações); `forms.mjs` AC06.1-editar-prefill/invalido, AC06.1-excluir-cancelar; `permissions.mjs`. |
| AC07.1 Utilizável a partir de 360 px sem rolagem horizontal | OK com dados do seed; FALHA com entradas longas | `responsive.mjs seed`: 23 combinações rota/papel × 320, 360, 390, 768, 1280 px (inclui as 13 rotas): sem transbordo, exceto `/admin` a 320 px (D4). `responsive.mjs stress` (título de 80 caracteres sem espaços, texto de 500 caracteres): `/itens` transborda em 320–390 px (D1) e `/admin/reivindicacoes/claim-01` transborda (D3). |
| AC07.2 Alvos de toque ≥ 44 px nas ações principais | OK (ressalva D8) | `responsive.mjs` e `touch.mjs`: todas as ações principais, botões, abas e campos ≥ 44 px. Únicos alvos menores: links de título em `/admin/devolucoes` (25 px nos cartões móveis, 19 px na tabela desktop) e o link "Pular para o conteúdo" (sr-only, visível e dimensionado ao receber foco). BottomNav/ActionBar não cobrem conteúdo nem foco: 11 rotas × 320/360/390 px, 33 verificações OK. |
| AC08.1 Formulários acessíveis, foco visível, teclado, contraste AA, diálogos com foco preso e Esc | OK (ressalvas D2, D6) | `forms.mjs` (label, aria-invalid, aria-describedby, região viva, "Corrija N campos", foco no 1º inválido); `keyboard.mjs` (skip link, menu da conta, diálogo: foco preso em 15 voltas, Esc e retorno de foco, Esc e scrim ignorados durante envio, abas com setas/Home/End, sheet com Esc); `a11y.mjs` axe: 0 contraste. Ver nota sobre "FALHAs" do `keyboard.json` em §3.3. |

Critérios fora da matriz AC, também cobertos: RNF01 (rótulos de demonstração), `lang="pt-BR"`, um `h1` por tela, landmarks, status não só por cor, `prefers-reduced-motion`, ausência de requisições externas (§3).

---

## 3. Resultados por frente de teste

### 3.1 Fluxo completo de demonstração (`e2e-flow.mjs`)

Contextos separados por usuário (a sessão é por aba; o banco, em `localStorage`, é compartilhado). Percorrido, tudo OK: cadastro, persistência ao recarregar, sair, login por e-mail, item com foto (4000×3000 JPEG salvo como 640×480, 229.975 caracteres) e sem foto, reivindicação por Rafael e Marina, estados da reivindicação, painel do admin, análise, recusa da última ativa (item volta a Disponível e Rafael não reenvia), aceite (recusa automática das demais), bloqueio P14, devolução com diálogo, item fora da busca e listado em `/admin/devolucoes` com filtro de período, sem botão de exportar, "Minhas reivindicações" (Aceita + Devolvido / Recusada), item devolvido somente leitura, exclusão pelo admin removendo as reivindicações. Erros de console: nenhum nos 4 perfis.

### 3.2 Permissões (`permissions.mjs`)

15 rotas × anônimo/aluno/professor/admin, conforme SPEC §2. Anônimo → `/entrar`. Aluno e professor em `/admin/**` → "Acesso restrito". Admin não vê "É meu" e `/itens/:id/reivindicar` mostra o motivo. Aluno dono do item não vê reivindicações de terceiros no detalhe. Navegação: aluno/professor (cabeçalho: Itens, Minhas reivindicações, Registrar item; barra inferior: Itens, Registrar, Reivindicações); admin (cabeçalho: Painel, Itens, Devoluções; barra inferior com 4 itens). `aria-current="page"` correto no cabeçalho (1280) e na barra inferior (390).

### 3.3 Acessibilidade

- **axe-core** (`a11y.mjs`, cerca de 91 estados em 390 e 1280 px, incluindo erros, diálogos, sheet e estados vazios): sem violações críticas, sérias ou de contraste. Moderadas: `region` em 80 estados (D6), `heading-order` em `/admin` no celular (D6) e `landmark-one-main` apenas no 404 (D5).
- **Estrutura** (`structure.json`): `lang="pt-BR"`, exatamente um `h1` por estado (exceto 404), `main` único, título por rota (ver D11 para exceções).
- **Teclado** (`keyboard.mjs`): skip link visível ao focar, login por teclado, Enter no cartão, reivindicação por Espaço, menu da conta (setas, Esc, foco devolvido), diálogos nativos modais (foco preso, Esc devolve foco ao gatilho), abas com roving tabindex, sheet de filtros com Esc. Depois de navegação client-side o foco fica em BODY (I1).
- **Foco visível**: no `keyboard.json`, os checks `AC08.1-kb-foco-itens`, `AC08.1-kb-foco /itens/novo` e `AC08.1-kb-foco /admin/devolucoes` aparecem como FALHA. A análise manual desses casos (captura `probe7-tab1..5.png`) mostra que o único tab stop "sem indicador" é o 4.º de cada campo de data (ícone do seletor de calendário), onde o navegador desenha o anel de foco padrão; os campos mês, dia e ano têm indicador. **Falso positivo do script**, não defeito de produto. O mesmo vale para `AC08.x-status-cor` (1 badge "sem ícone": é a aba "Em reivindicação" em `/admin`, que é uma aba e não um badge de status); os 27 badges de status verificados têm texto e ícone SVG.
- **Movimento reduzido**: com `prefers-reduced-motion: reduce`, 17 animações ativas caem para 0.
- Meta viewport permite zoom; modo escuro do SO mantém tema claro legível; nenhuma requisição a hosts externos (fontes auto-hospedadas).

### 3.4 Formulários (`forms.mjs`)

Validação, `aria-invalid`, `aria-describedby`, região viva, foco no primeiro campo inválido e "Corrija N campos" corretos em login, cadastro, registro de item, reivindicação (duas perguntas, mínimos) e edição. Duplo envio: cadastro e reivindicação criam 1 registro; item: ver D7. Perda de dados: com `localStorage.setItem` lançando (STORAGE_FULL) o formulário de item, o de reivindicação e o aceite do admin mantêm os dados e mostram o erro; o item foi gravado após "restaurar". Arquivo `falso.jpg` (texto): aceito na pré-visualização, falha ao enviar com "Não foi possível ler a imagem. Tente outro arquivo." e os dados do formulário são mantidos.

### 3.5 Os cinco itens declarados não verificados

| Item | Resultado | Evidência |
|---|---|---|
| (a) Redimensionamento real de foto por canvas | VERIFICADO, OK | `photo.mjs`: JPEG 4000×3000 (4,0 MB) → 640×480 (cerca de 168 KB); PNG 10,2 MB → 640×480; retrato 3000×4000 → 480×640; 300×200 não é ampliada; PNG transparente ganha fundo branco; foto aparece na lista e no detalhe (`naturalWidth > 0`); admin remove e troca; processamento 0,6 a 1,1 s. Cota: a 20.ª foto falha com STORAGE_FULL (cerca de 5,08 M de caracteres), sem perda de dados (D10). |
| (b) Sincronização entre abas (evento `storage`) | VERIFICADO, OK | `storage.mjs` e `misc.mjs`: aba do admin atualiza quando Rafael reivindica em outra aba (4 → 5 pendentes); aba de Marina muda Pendente → Aceita com a região viva anunciando; marcador `window.__m` preservado (sem reload); detalhe do item no admin também atualiza. Sessões são por aba. Não testada: condição de corrida de gravação simultânea entre abas (limitação documentada no próprio store). |
| (c) Estados de erro de carregamento | VERIFICADO, OK | `storage.mjs` ERRLOAD: dados corrompidos (`items=[null]`, ids fantasma) produzem ErrorState com "Tentar novamente" em todas as telas afetadas; tentar de novo com o dado ruim continua em erro; após corrigir o dado, o botão recupera. Sem crash nem `pageerror`. Alguns dados ruins são tolerados e renderizam normalmente (registrado como INFO). |
| (d) "Reiniciar demonstração" | VERIFICADO, OK | `storage.mjs` RESET-menu, RESET-login, RESET-seed-datas: confirmação em diálogo, restaura o seed (5 usuários, 9 reivindicações, 11 itens), encerra a sessão, mostra toast, datas relativas a hoje. Em outra aba, derruba a sessão criada e a aba volta a `/entrar` sem quebrar (`states.mjs` RACE). |
| (e) localStorage indisponível | VERIFICADO, sem quebra, sem aviso (D9) | `storage.mjs` LS-indisp: com `localStorage` lançando SecurityError, e com `localStorage` e `sessionStorage` lançando, `/entrar` carrega, perfil demo entra, navegação SPA funciona, sem erros; os dados ficam só em memória e se perdem ao recarregar. |

### 3.6 Estados de interface (`states.mjs`)

- Carregando (região "Carregando…" com `aria-busy`): 10 rotas.
- Vazio: `/itens`, Minhas reivindicações, as duas listas do painel, devoluções.
- Erro: ErrorState com "Tentar novamente" (ver 3.5c); erro de gravação em ação do admin fecha o diálogo, mostra toast e mantém a reivindicação pendente.
- Sucesso: toasts "Item registrado. Ele já aparece na busca.", "Alterações salvas.", "Item excluído.", "Reivindicação recusada.", "Reivindicação aceita.", "Devolução registrada. O item saiu da busca."
- Indisponível: "Item não encontrado" quando o admin exclui o item com o formulário aberto (a tela se atualiza sozinha), e motivos explicados em item aceito/devolvido (P14).
- Latência: o diálogo de decisão fecha em cerca de 0,8 s (`probe-latencia-decisao.mjs`). O check `LAT` de `rules.mjs` aparece como FALHA porque mede o envio de reivindicação de ponta a ponta (2133 ms = criar + redirecionar + recarregar a lista, várias latências encadeadas); a faixa de 300–600 ms da SPEC é por operação e não foi violada. **Não é defeito.** Um valor de "4864 ms" visto numa execução anterior foi artefato de medição (`waitFor detached`) e não latência real.

### 3.7 Rótulos de demonstração / RNF01

Faixa de demonstração em toda página; aviso completo em `/entrar` e no rodapé desktop (oculto no celular); "Papel informado no cadastro"; nota de que categorias e locais são valores de demonstração; nada sugere segurança real. Lacuna: ver D12.

---

## 4. Defeitos

Severidades: **Bloqueia demo** / **Alta** / **Média** / **Baixa**. Nenhum Bloqueia demo ou Alta.

### D1 — Média — Título longo sem espaços causa rolagem horizontal em `/itens`
- **Rota/arquivo provável:** `/itens`; `frontend/src/components/ui/ItemCard.tsx` (título com `line-clamp-2` e sem quebra de palavra).
- **Passos:** logar como Marina, registrar um item com título de 80 caracteres sem espaços (por exemplo `MMMM…`), abrir `/itens` a 360 px. Reproduz com `node responsive.mjs stress`.
- **Esperado:** o título quebra ou é truncado dentro do cartão (DESIGN: "título quebra"; AC07.1).
- **Obtido:** `scrollWidth` 1094 contra 360 (e 320, 390): a página inteira rola na horizontal. O detalhe do item não transborda (`sw/iw = 360/360`); a lista, sim (1118/360 em `forms.mjs` AC02.1-titulo-longo). Captura: `defeito-lista-titulo-longo-360.png`.
- **Sugestão (dev):** `break-words`/`overflow-wrap:anywhere` e `min-w-0` no contêiner do título.

### D2 — Média (a11y) — Botão de foto com nome acessível "Foto (opcional)"
- **Rota/arquivo provável:** `/itens/novo`, `/admin/itens/:id/editar`; `frontend/src/components/ui/FileInput.tsx` + `Field.tsx` (`useFieldControl` dá ao botão o `id` do campo, e o `<label for>` "Foto (opcional)" sobrepõe o conteúdo do botão).
- **Passos:** abrir `/itens/novo`; inspecionar a árvore de acessibilidade (CDP) ou procurar o botão por nome "Adicionar foto" / "Trocar foto".
- **Esperado:** nome acessível igual ao texto visível ("Adicionar foto", "Trocar foto"); WCAG 2.5.3 (rótulo no nome) e controle por voz.
- **Obtido:** o nome é "Foto (opcional)" mesmo com o texto visível "Trocar foto". O check `AC02.2-preview` de `forms.mjs` falha por isso.
- **Sugestão (dev):** usar `aria-labelledby` combinando rótulo do campo e texto do botão, ou não ligar o `for` do label ao botão.

### D3 — Baixa — Análise da reivindicação transborda com texto longo sem espaços
- **Rota/arquivo provável:** `/admin/reivindicacoes/:id`; componentes de `components/claims/` que exibem as respostas.
- **Passos:** como Marina, reivindicar com 500 caracteres sem espaços no campo "detalhes"; abrir a análise como admin a 360 px (`responsive.mjs stress`).
- **Esperado:** texto quebra. **Obtido:** `scrollWidth` 5164 a 320–390 px. Captura: `forms-detalhe-texto-longo-360.png`.

### D4 — Baixa — `/admin` transborda 10 px a 320 px
- **Rota/arquivo provável:** `/admin`; bloco de estatísticas (tile "Devoluções").
- **Passos:** logar como admin, abrir `/admin` a 320 px. **Obtido:** `scrollWidth` 330. **Esperado:** sem rolagem horizontal. A SPEC (AC07.1) exige apenas 360 px; a 360, 390, 768 e 1280 está correto.

### D5 — Baixa — 404 padrão do Next em inglês, sem navegação
- **Rota/arquivo provável:** qualquer rota inexistente, por exemplo `/rota-inexistente`; não existe `frontend/src/app/not-found.tsx`.
- **Obtido:** "404 / This page could not be found.", sem landmark `main`, sem link de volta, título genérico, `h1` "404". **Esperado:** página em pt-BR com identidade e caminho de volta. Captura: `defeito-404-390.png`. É também o único estado que loga erro de console.

### D6 — Baixa (a11y) — Faixa de demonstração fora de landmark; ordem de títulos em `/admin` móvel
- **Rota/arquivo provável:** `frontend/src/components/layout/DemoNotice.tsx` (`DemoBanner` fica fora de qualquer landmark); painéis de aba de `/admin`.
- **Obtido:** axe `region` (moderado) em 80 estados; `heading-order` (h1 → h3, sem h2) nas abas de `/admin` no celular. Sem impacto funcional.

### D7 — Baixa — Duplo disparo síncrono no formulário de item cria 2 itens
- **Rota/arquivo provável:** `/itens/novo`; `frontend/src/components/items/ItemForm.tsx` (`if (status !== "idle") return;` só protege após o estado assíncrono atualizar).
- **Passos:** disparar dois `click` síncronos no botão "Registrar item" (`forms.mjs` AC08.1-item-duplo, 2 itens criados).
- **Esperado:** 1 item. **Obtido:** 2. **Não reproduzido** com duplo clique real, Enter nem cliques com 10 ms de intervalo (criam 1). Cadastro e reivindicação não têm o problema. Sugestão: `useRef` como trava síncrona.

### D8 — Baixa — Links de item em `/admin/devolucoes` abaixo de 44 px
- **Rota/arquivo provável:** `/admin/devolucoes`.
- **Obtido:** links de título com 25 px de altura nos cartões móveis e 19 px na tabela desktop (também abaixo dos 24 px de WCAG 2.5.8). São links secundários; as ações principais cumprem AC07.2.

### D9 — Baixa — Sem aviso ao usuário quando o localStorage está indisponível
- **Rota/arquivo provável:** `frontend/src/services/mock/` (store).
- **Passos:** abrir em janela/ambiente com armazenamento bloqueado e usar o app. **Obtido:** funciona só em memória; ao recarregar, tudo se perde, sem mensagem. **Esperado (sugestão):** aviso discreto de que os dados não serão salvos.

### D10 — Baixa — Mensagem de cota cheia sugere "foto menor", mas todas as fotos já são ≤ 640 px
- **Rota/arquivo provável:** `/itens/novo` (erro STORAGE_FULL).
- **Obtido:** a cota do navegador (cerca de 19 fotos) é atingida e a mensagem diz "Tente uma foto menor". **Esperado:** orientar a reiniciar a demonstração ou remover itens. Captura: `photo-cota-cheia-390.png`.

### D11 — Baixa — Títulos de aba imprecisos
- **Obtido:** a tela "Acesso restrito" mantém o título "Painel · CampusLost"; as páginas de detalhe compartilham o título genérico "Detalhe do item". Afeta orientação por leitor de tela e histórico do navegador.

### D12 — Baixa (honestidade/RNF01) — Dados fictícios não rotulados na interface
- **Arquivo provável:** `frontend/src/services/mock/seed.ts` exporta `DEMO_DATA_NOTICE`, mas a constante não é usada na interface.
- **Obtido:** o aviso "dados fictícios" aparece só de forma genérica (faixa de demonstração e e-mails `@demo.test`); itens e pessoas do seed não são rotulados como demonstrativos. CLAUDE.md exige que dados demonstrativos sejam identificáveis como tais.

### Observações informativas (não são defeitos)
- **I1:** após navegação client-side o foco permanece em BODY (não vai ao título nem ao `main`). Melhoria de a11y opcional.
- **I2:** ao registrar a devolução o app redireciona para `/admin/devolucoes`; o DESIGN §9.9 descreve "volta ao painel". Divergência de design, decisão do orquestrador.
- **I3:** dados corrompidos específicos são tolerados em vez de gerar ErrorState (ver 3.5c); aceitável.

---

## 5. O que NÃO foi testado e por quê

- **Dispositivos reais, zoom de 200 % e teclado virtual do celular:** só Chromium headless em viewports emulados.
- **Safari, Firefox e Edge:** só Chromium; os campos de data do Chromium headless aparecem como mm/dd/aaaa por causa do locale do sistema, então a máscara em pt-BR não foi observada.
- **Leitor de tela (NVDA, VoiceOver, TalkBack):** não executado; foram verificados árvore de acessibilidade, nomes, `aria-*` e regiões vivas por script, o que não substitui teste com leitor.
- **`forced-colors` (alto contraste do Windows):** não testado.
- **Corrida de gravação simultânea entre abas** (duas abas escrevendo no mesmo instante; limitação documentada no store) e **decisão concorrente do admin em aba desatualizada:** não testados.
- **Backend, autenticação real, desempenho com muitos dados:** fora do escopo da fase.
- **Cobertura de AC por inspeção visual:** capturas em 320, 360 e 1280 px foram revisadas por mim, sem comparação automatizada com o Figma (não há arquivo de design acessível nesta tarefa).

---

## 6. Como reproduzir

Pré-requisitos (fora do repositório): Node ≥ 20.9, Chromium (por padrão `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, ajustável com `QA_CHROME`), Python com Pillow para gerar imagens.

```
# 1) Ferramentas de QA fora do repo
mkdir -p /tmp/qa-tools && cp docs/prototype/qa/scripts/* /tmp/qa-tools/ && cd /tmp/qa-tools
npm install                              # playwright-core + axe-core (package.json desta pasta)
python3 genimg.py /tmp/qa-tools/imgs     # imagens de teste (4000x3000 JPG/PNG, GIF, falso.jpg, >10 MB)

# 2) App em modo produção (a partir de frontend/)
cd <repo>/frontend && npm install && npm run build
npx next start -p 3110 &                 # guarde o PID e encerre só esse processo com kill <PID>

# 3) Testes (de /tmp/qa-tools); variáveis opcionais: QA_BASE, QA_OUT (padrão /tmp/qa-out), QA_IMGS, QA_CHROME, ONLY=<regex de id>
node e2e-flow.mjs        # fluxo completo
node permissions.mjs     # permissões rota x papel
node forms.mjs           # formulários
node search.mjs          # busca e filtros
node photo.mjs           # foto por canvas e cota
node storage.mjs         # sync entre abas, erros de carga, reiniciar demo, localStorage indisponível
node states.mjs          # estados e corridas
node rules.mjs           # regras de estado e premissas
node misc.mjs            # rede externa, viewport, aria-current, 404, modo escuro
node a11y.mjs            # axe + estrutura
node keyboard.mjs        # teclado, foco, movimento reduzido
node touch.mjs           # alvos de toque e barras fixas
node responsive.mjs seed # transbordo/alvos nos 5 larguras (dados do seed)
node responsive.mjs stress   # idem com entradas longas (D1, D3)
node shots.mjs 360       # capturas de tela
```

Observações: cada script grava `QA_OUT/<nome>.json` e imprime `OK/FALHA/INFO`. Rodar `storage.mjs`, `rules.mjs` e `e2e-flow.mjs` altera o banco do navegador isolado de cada contexto (não o seu), mas convém reiniciar o servidor entre execuções longas. Os "FALHA" esperados nos JSONs desta rodada são: `forms` AC02.2-preview (efeito do D2), AC08.1-item-duplo (D7), AC02.1-titulo-longo (D1); `keyboard` AC08.1-kb-foco-* (falso positivo do seletor de data) e AC08.x-status-cor (falso positivo da aba); `misc` A11Y-404 (D5) e A11Y-titulo-negado (D11); `rules` LAT (medição encadeada, não é defeito).
As capturas desta rodada ficaram no diretório de saída do ambiente de execução (`QA_OUT`), não no repositório.

Scripts: `lib.mjs`, `rec.mjs` (utilitários), `genimg.py`, `e2e-flow.mjs`, `permissions.mjs`, `forms.mjs`, `search.mjs`, `photo.mjs`, `storage.mjs`, `states.mjs`, `rules.mjs`, `misc.mjs`, `a11y.mjs`, `keyboard.mjs`, `touch.mjs`, `responsive.mjs`, `shots.mjs`, `probe-latencia-decisao.mjs`, `probe-toast-devolucao.mjs`. Verificados apenas com `node --check` (sintaxe) depois de portar os caminhos para variáveis de ambiente; a última execução completa foi feita com as versões originais fora do repositório.

---

## 7. Relatório de entrega (formato COORDENACAO.md)

**Arquivos alterados**
- `docs/prototype/qa/RELATORIO-QA.md` (novo)
- `docs/prototype/qa/scripts/*` (novo): 17 scripts `.mjs`, `genimg.py`, `package.json`.
- Nenhum arquivo de produto alterado; `git status` limpo antes de criar os arquivos de QA.

**O que foi implementado**
- Suíte de QA automatizada sobre o app renderizado e o relatório com a matriz AC × resultado, defeitos, itens não testados e roteiro de reprodução.

**O que foi testado** (tudo executado, sem suposições)
- `lint`, `typecheck`, `test` (215 testes) e `build` (13 rotas): passam.
- Fluxo completo de demonstração, permissões por papel (15 rotas × 4 perfis), formulários, busca/filtros, responsividade (5 larguras × rotas, dados do seed e de estresse), axe em cerca de 91 estados, teclado e foco, movimento reduzido, estados de UI, rótulos RNF01 e os cinco itens declarados não verificados.

**Problemas encontrados**
- 12 defeitos: 0 Bloqueia demo, 0 Alta, 2 Média (D1 transbordo da lista com título longo; D2 nome acessível do botão de foto), 10 Baixa (D3 a D12). Detalhes, passos e arquivos prováveis em §4.

**Pendências**
- Correção dos defeitos pelos donos dos arquivos (principalmente D1 e D2 em `ItemCard.tsx` e `FileInput.tsx`/`Field.tsx`; D5 exige novo `not-found.tsx`).
- Decisão do orquestrador sobre I2 (redirecionamento pós-devolução) e D12 (usar `DEMO_DATA_NOTICE`).
- Não testados: leitor de tela, dispositivos reais, Safari/Firefox, `forced-colors`, corrida de escrita entre abas.
- Reexecutar `node keyboard.mjs` e `node responsive.mjs stress` depois das correções para confirmar D1–D4.
<<<<<<< HEAD
=======


---

## 8. Rodada 2 — regressão pós-correções e validação do roteiro (executada pelo orquestrador)

**Contexto.** A rodada 2 foi planejada para um agente de QA que foi interrompido antes de escrever resultados; as alterações parciais dele **não** foram aproveitadas. Os resultados abaixo foram obtidos pelo orquestrador, rodando os scripts desta pasta contra o build de produção do commit `26c9c8a` (branch `feature/prototipo-frontend`), em Chromium headless, porta 3140. Os scripts rodaram a partir de uma cópia fora do repositório (dependências `playwright-core` e `axe-core` instaladas lá).

### 8.1 O que foi reexecutado e resultado

| Script | Resultado | Observação |
|---|---|---|
| `e2e-flow` | 32 OK, 0 FALHA | fluxo completo, 3 perfis, cadastro, aceite/recusa, devolução, exclusão |
| `permissions` | matriz conforme SPEC §2 (conferida manualmente) | aluno e professor: "Acesso restrito" em todas as rotas `/admin/**`; só a administração vê Painel/Editar/Excluir; administração nunca vê "É meu"; 404 próprio em pt-BR |
| `search` | 19 OK, 0 FALHA | |
| `states` | 19 OK, 0 FALHA | |
| `rules` | 6 OK, 1 FALHA (falso positivo) | `LAT`: envio de reivindicação 2149 ms e login 556 ms. É latência **encadeada** (várias operações de 300–600 ms), já documentada; não é regressão |
| `storage` | 11 OK, 0 FALHA | sync entre abas sem recarregar (admin e usuária), sessão por aba, reiniciar demo (menu e login), datas do seed, `localStorage` e `sessionStorage` indisponíveis. A primeira execução estourou meu limite de tempo (o navegador foi encerrado pelo `timeout`) e foi refeita sem limite curto |
| `a11y` (axe) | 91 OK, 0 FALHA | 0 violações em 91 estados |
| `touch` | 33 OK, 0 FALHA | |
| `responsive seed` | 115 combinações: 0 transbordos, 0 barras cobrindo conteúdo | 320, 360, 390, 768, 1280 px |
| `responsive stress` | 115 combinações: 0 transbordos, 0 barras cobrindo conteúdo | entradas longas; confirma D1, D3 e D4 corrigidos |
| `storage-volatil` | OK | com `localStorage` bloqueado a faixa mostra "Seus dados desta demonstração não serão guardados neste navegador e serão perdidos ao recarregar." em região `role="status"` (D9) |

Observação: em todas as linhas de `responsive` aparece `alvos<44:1`. É sempre o link oculto "Pular para o conteúdo" (32×24 px, visível só ao receber foco por teclado), não um alvo de toque real.

**Não reexecutados por mim** (verificados apenas pelo agente da correção T10c, a 71f8662): `forms`, `photo`, `misc` (inclui título de aba e 404), `keyboard` (4 FALHA conhecidas, falsos positivos já descritos na rodada 1). Tratar estes resultados como relatados, não como confirmados de forma independente.

### 8.2 Estado dos defeitos da rodada 1

| ID | Estado | Evidência |
|---|---|---|
| D1, D3, D4 | **Corrigidos, verificados por mim** | `responsive stress`: 0 transbordos a 320/360/390 px em `/itens`, análise `claim-01` e `/admin` |
| D5 | Corrigido, verificado por mim | `permissions`: `/rota-inexistente` mostra "Página não encontrada" |
| D6 | Corrigido, verificado por mim | `a11y`: 0 violações em 91 estados (some `region` e `heading-order`) |
| D8 | Corrigido, verificado por mim | `touch`: 33 OK |
| D9 | Corrigido, verificado por mim | `storage-volatil` e `storage` |
| D12 | Corrigido, verificado por mim | a faixa e o aviso de modo demonstração dizem que usuários, itens, categorias e locais são fictícios |
| D2, D7, D10, D11 | Corrigidos conforme o agente T10c; **não reconfirmados por mim** | dependem de `forms`, `photo` e `misc` |

### 8.3 Validação do `DEMO.md` (percurso manual por script, 390 px e 1280 px)

O percurso `demo-walk.mjs` (duas abas no mesmo contexto, sessões separadas) completou o ciclo inteiro — reiniciar demo → aluna registra item → professor reivindica → administração analisa e aceita → registra devolução → item aparece em `/admin/devolucoes` e some da busca — sem erro de console nas duas larguras. Divergências entre o rascunho do roteiro e a tela, **já corrigidas no `DEMO.md`**:

- botões de perfil são "Aluno demo", "Professor demo" e "Administração demo" (não "Aluno/Professor/Administração");
- o painel `/admin` já tem 5 reivindicações pendentes do estado inicial: é preciso achar a linha do item novo ("Enviada hoje") e clicar em **Analisar**;
- o texto exato dos erros, avisos, diálogos e rótulos de campo (ver seção 3 do roteiro);
- após enviar a reivindicação o app abre **Minhas reivindicações** (não o detalhe do item);
- "Reiniciar demonstração" existia na tela de entrada **e** no Menu da conta (a partir de 20/10/2026 só no Menu da conta).

Um falso alarme do próprio script (busca por "Garrafa térmica" casava com o item do seed "Garrafa térmica verde") foi investigado e **não** era defeito: pelo link exato, o item devolvido não aparece na busca.

Verificações manuais adicionais (`residual.mjs`): o "voltar" do celular preserva a origem (`/itens?categoria=Chaves`; de Ver item a partir de Minhas reivindicações volta a `/minhas-reivindicacoes`); a faixa de demonstração ocupa 78 px (3 linhas) a 360 e 390 px, no fluxo da página, sem cobrir nada; **o foco do teclado cai no `BODY` após navegação entre telas** (existe o link "Pular para o conteúdo").

### 8.4 Defeitos e riscos que continuam abertos

- **Foco após navegação client-side fica no `BODY`** (informativo I1 da rodada 1): limitação de acessibilidade real, severidade baixa a média para usuários de teclado e leitor de tela; não corrigida.
- **Latência encadeada de ~2 s** no envio de reivindicação (simulada): pode parecer travamento numa demonstração ao vivo.
- Faixa de demonstração com 3 linhas no celular: decisão de texto, não de defeito.
- Não testados: leitor de tela, dispositivos reais, zoom de 200%, teclado virtual, Safari/Firefox/Edge, `forced-colors`, comparação visual com o Figma.

### 8.5 Veredito

**Aprovado para demonstração, com ressalvas** (0 defeitos que bloqueiam a demo; ressalvas: seção 8.4 e os resultados de `forms`/`photo`/`misc`/`keyboard` não reconfirmados nesta rodada). Os cinco itens que os desenvolvedores haviam declarado "não verificados" seguem verificados em Chromium real.
>>>>>>> 40889fbe11ac4bae1f425d3e85f3efebf53bc50d
