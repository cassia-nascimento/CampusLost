# CampusLost — API REST (FastAPI + SQLite)

Documento de referência para escrever o cliente REST do frontend (`services/api/*`, trocando o mock em `services/index.ts`). Tudo aqui foi conferido contra a implementação em `backend/` e contra `frontend/src/services/contracts.ts`; os testes em `backend/tests/` cobrem cada regra citada.

Rótulos usados: **[Contrato]** vem de `contracts.ts`/`types/domain.ts`; **[Premissa]** é escolha deste backend (ver `SPEC.md` §9, P31).

## 1. Convenções gerais

| Tema | Regra |
|---|---|
| Base | `http://127.0.0.1:8000` em desenvolvimento (`uvicorn app.main:app --port 8000`). Sem prefixo de versão. Variável sugerida no frontend: `NEXT_PUBLIC_API_URL`. |
| Formato | JSON (`Content-Type: application/json`), exceto criar/editar item (`multipart/form-data`). Chaves em camelCase, iguais às de `types/domain.ts`. |
| Autenticação | **Dois modos, ambos presos a uma linha da tabela `sessions`.** (a) `Authorization: Bearer <token>` (cliente atual): o token vem de `signup`, `login`, `google`, `google/complete`, `refresh` ou `demo/login`; JWT HS256 de `ACCESS_TOKEN_EXPIRE_MINUTES` (padrão 8 h). (b) Cookies HttpOnly (§4.2.3): `cl_access` (15 min) + `cl_refresh` (7 dias, rotativo). Se vierem os dois, o **Bearer vence**. `POST /auth/logout` revoga a sessão (Bearer e cookies morrem juntos); redefinir a senha revoga todas. |
| Token inválido | Cabeçalho `Authorization` presente mas token expirado/adulterado/revogado/de usuário que não existe mais (ou anonimizado) ⇒ **401 `UNAUTHENTICATED`** "Sua sessão expirou. Entre novamente.", **inclusive nos endpoints públicos** (`GET /items`, `GET /items/{id}`). O cliente deve descartar a sessão. Sem cabeçalho = visitante. |
| Datas de calendário | `YYYY-MM-DD` (`foundDate`, filtros `from`/`to`), no fuso do servidor (`APP_TIMEZONE`, padrão `America/Fortaleza`). "Hoje" (data não futura, datas relativas do seed) usa esse fuso. |
| Instantes | ISO 8601 em UTC com milissegundos e `Z`: `2026-10-22T15:00:00.000Z` (`createdAt`, `reviewedAt`, `returnedAt`, `expiresAt`). |
| Campos ausentes | `reviewedAt` é **omitido** enquanto a reivindicação não foi analisada (como `reviewedAt?: string`). `photoUrl` é sempre presente: string ou `null`. |
| IDs | Strings opacas. Seed: `user-marina`, `item-01`, `claim-01`, `return-01`… Novos: `item-<10 hex>` etc. |
| Corpo máximo | 11 MB (`MAX_BODY_BYTES`). Acima disso: 413. |
| CORS | Apenas as origens de `CORS_ORIGINS` (padrão `http://localhost:3000`, nunca `*`). Métodos GET/POST/PUT/PATCH/DELETE; cabeçalhos `Authorization`, `Content-Type`, `X-Requested-With`. `Access-Control-Allow-Credentials: true` (cookies). No `fetch`, use `credentials: "include"` para o modo cookie. |
| CSRF (modo cookie) | Requisição **autenticada por cookie** com método mutável (POST/PUT/DELETE) exige o cabeçalho `X-Requested-With` (qualquer valor não vazio, ex. `fetch`) e, se houver `Origin`, que esteja em `CORS_ORIGINS`; senão **403 `CSRF_FAILED`**. Com Bearer não é necessário. Mande o cabeçalho em **todas** as chamadas mutáveis do modo cookie (inclusive `refresh`, `logout`, `resend-verification`). |
| Segurança | O hash de senha nunca sai da API. Todos os textos devolvidos estão em pt-BR. Toda resposta traz `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e `Referrer-Policy: no-referrer`; `/auth/*`, `/me/*` e `/admin/*` também `Cache-Control: no-store`; fora de development/test, `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Para o Next, veja §7. |

### 1.1 Formato de erro

Toda falha tem este corpo (mesmo para 404 de rota, 405, 413 e 500):

```json
{ "code": "VALIDATION", "message": "Confira os campos destacados.", "fieldErrors": { "title": "Use pelo menos 3 caracteres." } }
```

`code` é um `ServiceErrorCode` do frontend e `message` já é texto apresentável. `fieldErrors` só aparece em `VALIDATION` (uma mensagem por campo, a primeira que falhou), em `EMAIL_TAKEN` (`{"email": "..."}`) e em `INVALID_CREDENTIALS` de `DELETE /me` (`{"password": "..."}`). O cliente cria `new ServiceError(code, message, { fieldErrors })` direto do corpo.

| `code` | HTTP | Quando |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Sem sessão ("Entre na sua conta para continuar."), token inválido/expirado ("Sua sessão expirou. Entre novamente."), credencial Google inválida. |
| `INVALID_CREDENTIALS` | 401 / 403 | Login: e-mail inexistente, senha errada, conta só-Google ou conta excluída (401, mensagem única: "E-mail ou senha incorretos."). **403** em `DELETE /me` com confirmação errada. |
| `FORBIDDEN` | 403 | Papel sem permissão. Também em `POST /items/{id}/claims` quando o usuário autenticado é quem **registrou o item** (`items.created_by_id`, P46/AC04.12): "Você registrou este item, então não pode reivindicá-lo. Se ele é seu, procure a administração." Nada é gravado; o `viewer.claim` do detalhe já traz `allowed:false, code:"FORBIDDEN"` com essa mensagem. Administração continua barrada antes, pela capacidade. |
| `FORBIDDEN_DOMAIN` | 403 | **Não é mais emitido** (e-mail Google fora do domínio institucional agora vira conta com `affiliation: external`). Mantido na tabela por compatibilidade com o tipo do frontend. |
| `CSRF_FAILED` | 403 | **Novo.** Modo cookie sem `X-Requested-With` ou com `Origin` não permitida. |
| `INVALID_TOKEN` | 400 | **Novo.** Link de e-mail (`verify-email`, `reset-password`) inexistente, expirado, já usado ou de outra finalidade: "Link inválido ou expirado. Peça um novo." |
| `CAPTCHA_FAILED` | 400 | **Novo.** Só com `TURNSTILE_SECRET` definido: `turnstileToken` ausente/recusado ou Cloudflare inacessível (falha fechada). |
| `NOT_FOUND` | 404 | Item/reivindicação inexistente; **item devolvido para visitante**; rota inexistente; `/demo/*` desligado. |
| `VALIDATION` | 422 | Campos inválidos (`fieldErrors`). Também 413 (corpo grande demais) e 400 (multipart malformado) com `message` própria. |
| `PHOTO_INVALID` | 422 | Foto fora do formato/tamanho (sem `fieldErrors`). Também 413 em upload acima do limite do corpo. |
| `EMAIL_TAKEN` | 409 | E-mail já cadastrado. |
| `INVALID_TRANSITION` | 409 | Transição de estado não permitida (ex.: devolver sem reivindicação aceita; analisar reivindicação já analisada). |
| `DUPLICATE_CLAIM` | 409 | Usuário já tem reivindicação ativa/aceita no item. |
| `CLAIM_BLOCKED` | 409 | Reivindicação recusada antes (sem reenviar) ou item já com reivindicação aceita (P14). |
| `ITEM_RETURNED` | 409 | Item devolvido é somente leitura. |
| `RATE_LIMITED` | 429 | **Novo, não existe em `ServiceErrorCode`** — adicionar ao tipo. Também: conferência do código de retirada bloqueada após 5 falhas por 15 min (§4.5). Login (e confirmação de `DELETE /me`): 10 falhas por IP+e-mail bloqueiam por 60 s, depois 2 min, 4 min… até 1 h (§4.2.5). Rotas de e-mail/medidor: 20 pedidos/h por IP. Traz `Retry-After` (segundos). |
| `ACCOUNT_DISABLED` | 403 | **Novo.** Conta desativada pela administração tentou entrar (senha ou Google; só depois de a senha estar certa) ou concluir o 2FA. Sessões e tokens de acesso da conta são revogados na hora da desativação. |
| `TWO_FACTOR_REQUIRED` | 403 | **Novo.** Administração sem 2FA ligado chamou `/admin/*` (§4.2.7). As rotas `/auth/2fa/*` continuam liberadas. |
| `UNEXPECTED` | 500 / 502 / 503 | Erro interno (sem detalhes), Google inacessível (502) ou não configurado (503). |
| `CONFLICT` | 409 | `DELETE /me` da única conta de administração; `PATCH /admin/users/{id}` em si mesmo ou no último admin ativo; 2FA já ativo/inativo; convite já aceito. |
| `NETWORK`, `STORAGE_FULL` | — | O servidor não os emite. `NETWORK` é do cliente (sem resposta/timeout). |

Ordem de verificação (igual à do mock): sessão → existência do recurso → permissão/estado → validação de campos → foto. Exceção: **criar reivindicação valida o corpo antes de checar sessão/papel**, como o mock.

### 1.2 Regra de `photoUrl`

- `photoUrl` substitui `photoDataUrl`. É `null` (sem foto) ou um **caminho relativo ao servidor da API**: `/uploads/<uuid32>.jpg|png|webp` (foto enviada) ou `/uploads/seed/<arquivo>.svg|webp` (ilustração do seed, P27).
- O cliente monta a URL final com `API_BASE + photoUrl` (ex.: `http://127.0.0.1:8000/uploads/seed/oculos.webp`). Se usar `next/image`, liberar o host da API em `images.remotePatterns` (e `dangerouslyAllowSVG` para os SVG do seed, ou usar `<img>`/`unoptimized`).
- Os arquivos são públicos (`GET /uploads/<arquivo>`, sem autenticação), com nome aleatório não adivinhável.
- A API **não redimensiona** (o mock reduzia para 640 px no navegador). O cliente pode continuar reduzindo antes de enviar; o limite do servidor é 10 MB.

## 2. Mapeamento `contracts.ts` ⇄ API

| Método do contrato | Chamada REST | Observação |
|---|---|---|
| `auth.getCurrentUser()` | `GET /auth/me` | **401 ⇒ devolver `null`** (a API não devolve `null`). Resposta: `User` puro. |
| `auth.signUp(input)` | `POST /auth/signup` | Resposta `Session`; guardar `token`, devolver `user`. |
| `auth.signIn(input)` | `POST /auth/login` | Idem. |
| `auth.signInWithGoogle(profile)` | `POST /auth/google` | **Muda a entrada**: envia `{credential}` (ID token bruto); a verificação é no servidor. `needs_terms` traz também `ticket` (e `profileToken`, mesmo valor, nome antigo); guardar para o passo seguinte. |
| `auth.completeGoogleSignUp(input)` | `POST /auth/google/complete` | Envia `{ticket, acceptTerms}` (sem `role`; e-mail/nome vêm do token). |
| `auth.signInAsDemo(key)` | `POST /demo/login/{key}` | Só com `DEMO_MODE=true`. |
| `auth.listDemoProfiles()` | `GET /demo/profiles` | Idem. |
| `auth.signOut()` | — | Descartar o token no cliente. |
| `items.list(filters)` | `GET /items?category=&location=&from=&to=&status=&sort=` | Resposta `ItemView[]`. |
| `items.get(id)` | `GET /items/{id}` | Resposta `ItemDetail`. |
| `items.create(input)` | `POST /items` (multipart) | Resposta `Item` (201). |
| `items.update(id, input)` | `PUT /items/{id}` (multipart) | `photo` ausente = mantém; arquivo = troca; `removePhoto=true` = remove (equivale a `photo: null`). |
| `items.delete(id)` | `DELETE /items/{id}` | 204 sem corpo. |
| `claims.create(itemId, input)` | `POST /items/{id}/claims` | Resposta `Claim` (201). |
| `claims.listMine()` | `GET /claims/mine` | `ClaimView[]`, mais recentes primeiro. |
| `claims.listPending()` | `GET /claims/pending` | `ClaimView[]`, mais antigas primeiro (P17). |
| `claims.listByItem(itemId)` | `GET /items/{id}/claims` | `ClaimView[]`, mais antigas primeiro. |
| `claims.get(claimId)` | `GET /claims/{id}` | `ClaimView`. |
| `claims.accept(claimId)` / `reject` | `POST /claims/{id}/accept` / `/reject` | `ClaimDecisionResult`. |
| `returns.register(itemId)` | `POST /items/{id}/return` | `ReturnView` (201); exige código conferido (§4.5). |
| `returns.issueCode(claimId)` | `POST /claims/{id}/return-code` | `{ code, issuedAt }` (200, só o dono; única vez em que o código aparece). |
| `returns.codeStatus(claimId)` | `GET /claims/{id}/return-code` | Dono: `{ issued, issuedAt }`; admin: + `verified`, `verifiedAt`, `verifiedUntil`, `attemptsLeft`, `lockedUntil`. |
| `returns.verifyCode(claimId, code)` | `POST /claims/{id}/return-code/verify` | Status de admin (200); 422 `fieldErrors.code`; 429 bloqueio. |
| `returns.list(period)` | `GET /returns?from=&to=` | `ReturnView[]`, mais recentes primeiro. |
| `demo.reset()` | `POST /demo/reset` | 204. Sem autenticação (como no mock). |
| `demo.persistence()` | — | Constante `"durable"` no cliente. |
| `subscribe(listener)` | — | **A API não notifica.** Reler após cada mutação própria e (para AC04.8) refazer a leitura por intervalo/foco da janela. |

Itens sem equivalente: o catálogo (`DEMO_CATEGORIES`/`DEMO_LOCATIONS`) também está em `GET /catalog`; o frontend pode seguir usando `types/catalog.ts`.

## 3. Tipos JSON

### `User` (`types/domain.ts: User`)
```json
{ "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "user" }
```
`role` é o papel de **acesso**: `"user" | "admin"` (só isso decide permissões; sempre checado no servidor). O vínculo com a instituição aparece em `affiliation` só no usuário da própria sessão (`AccountUser`) e nas listas de `/admin/users`.

### `AccountUser` = `User` + `"affiliation": "institutional" | "external"` + `"emailVerified": boolean` + `"hasPassword": boolean` + `"twoFactorEnabled": boolean` (2FA TOTP ligado; §4.2.7)
`hasPassword` = a conta tem senha (`false` em conta criada só pelo Google; o cliente usa para escolher a confirmação de `DELETE /me`: `password` ou `credential`). Devolvido **só para a própria pessoa** (`user` em `Session`, `GET /auth/me`). `false` = conta de senha que ainda não confirmou o e-mail (informativo: **não** bloqueia cadastrar item nem reivindicar; ver §4.2.1). O `User` que aparece em reivindicações/devoluções não tem esse campo.

### `PublicUser`
```json
{ "id": "user-lucas", "name": "Lucas Prado", "role": "user" }
```

### `Session` (resposta de login, cadastro, Google e demo)
```json
{
  "token": "eyJhbGciOi...",
  "tokenType": "bearer",
  "expiresAt": "2026-10-22T23:00:00.000Z",
  "user": { "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "user", "affiliation": "institutional", "emailVerified": true, "hasPassword": true, "twoFactorEnabled": false }
}
```
Além do corpo, `signup`, `login`, `google` (`signed_in`), `google/complete`, `refresh` e `demo/login` **definem os cookies** `cl_access` e `cl_refresh` (§4.2.3). Quem usa só Bearer pode ignorá-los.

### `Item` (completo; usuário logado) = `types/domain.ts: Item`
```json
{
  "id": "item-03",
  "title": "Chaveiro com três chaves",
  "description": "Chaveiro de borracha vermelho com três chaves, sendo uma delas de cadeado.",
  "category": "Chaves",
  "categoryOther": null,
  "foundLocation": "Bloco A",
  "foundDate": "2026-10-20",
  "storedAt": "Portaria",
  "photoUrl": "/uploads/seed/chaveiro.webp",
  "status": "under_claim",
  "createdById": "user-lucas",
  "createdAt": "2026-10-20T13:00:00.000Z"
}
```
`foundLocation`: **texto livre** (3–120). `categoryOther`: sempre presente (string ou `null`); só tem valor quando `category == "Outros"` (especificação, 3–40) e é informação pública. `storedAt` (local de guarda): **obrigatório** no registro e na edição (string 3–120) e **privado**: só aparece para administração ou para o reivindicante com reivindicação **aceita** enquanto o item aguarda devolução (ver abaixo).

`status`: `"available" | "under_claim" | "returned"`. Diferença para o tipo do frontend: `photoDataUrl?: string` ⇒ **`photoUrl: string | null`**.

### `ItemView` / `PublicItemView` (listas e detalhe)
- **Administração**: igual a `Item` (traz `storedAt` e `createdById`).
- **Usuário com reivindicação `accepted` NESSE item enquanto o item está `under_claim`** ("aguardando devolução"): igual a `Item`, **com** `storedAt`. Depois do registro da devolução (`returned`) a chave volta a ser omitida.
- **Demais usuários logados** (sem relação, quem registrou o item — por ser o autor —, reivindicação `pending` ou `rejected`, reivindicação aceita de OUTRO item): `Item` **sem a chave `storedAt`** (omitida, não `null`); traz `createdById`.
- A regra é única no servidor (`can_view_stored_at`, `app/rules/items.py`), usa só dados do banco (status da reivindicação e do item; nada vindo do cliente) e vale em todo ponto que serializa item: `GET /items`, `GET /items/{id}`, respostas de `POST`/`PUT /items`, `ClaimView.item` (`/claims/mine`, `/claims/{id}`, `/claims/pending`, `/items/{id}/claims`, accept/reject), `ReturnView.item` e `/me/export` (`itemsRegistered`). A transição `pending → accepted` (ação da administração) é o único gatilho que libera; `rejected` e `returned` voltam a ocultar.
- **Visitante** (sem `Authorization`): `PublicItemView` — **as chaves `storedAt` e `createdById` não existem no JSON**:
```json
{ "id": "item-03", "title": "...", "description": "...", "category": "Chaves", "categoryOther": null, "foundLocation": "Bloco A",
  "foundDate": "2026-10-20", "photoUrl": "/uploads/seed/chaveiro.webp", "status": "under_claim", "createdAt": "2026-10-20T13:00:00.000Z" }
```

### `Claim`
```json
{
  "id": "claim-01", "itemId": "item-03", "claimantId": "user-beatriz",
  "proofDetails": "Uma das chaves é de um cadeado de armário e tem um risco de esmalte azul.",
  "lostWhereWhen": "Perdi no Bloco A, ontem à tarde.",
  "status": "pending",
  "createdAt": "2026-10-21T19:00:00.000Z"
}
```
`status`: `"pending" | "accepted" | "rejected"`. Após análise acrescenta `"reviewedAt": "2026-10-22T15:00:00.000Z"`.

### `ClaimWithClaimant` = `Claim` + `"claimant": User` (completo, com e-mail).

### `ClaimView` = `Claim` + `"claimant": User` + `"item": Item` (o `item` segue a regra de `storedAt` do visualizador: administração, ou o reivindicante aceito com o item aguardando devolução).
```json
{
  "id": "claim-06", "itemId": "item-07", "claimantId": "user-marina",
  "proofDetails": "...", "lostWhereWhen": "...", "status": "pending", "createdAt": "2026-10-21T09:00:00.000Z",
  "claimant": { "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "user" },
  "item": { "id": "item-07", "title": "Calculadora científica", "...": "...", "storedAt": "Portaria", "photoUrl": "/uploads/seed/calculadora.webp", "status": "under_claim", "createdById": "user-lucas", "createdAt": "2026-10-19T13:00:00.000Z" }
}
```

### `ReturnRecord`
```json
{ "id": "return-01", "itemId": "item-10", "claimId": "claim-08", "returnedToId": "user-beatriz", "registeredById": "user-admin", "returnedAt": "2026-10-17T15:00:00.000Z" }
```

### `ReturnView` = `ReturnRecord` + `"item": Item` + `"returnedTo": User` + `"registeredBy": PublicUser`.

### `Decision` e `viewer` (`ItemViewerPermissions`)
`Decision` é `{"allowed": true}` ou `{"allowed": false, "code": "<ServiceErrorCode>", "message": "<pt-BR>"}`.
```json
"viewer": {
  "claim":          { "allowed": false, "code": "DUPLICATE_CLAIM", "message": "Você já tem uma reivindicação em andamento para este item." },
  "edit":           { "allowed": false, "code": "FORBIDDEN", "message": "Somente a administração pode editar itens." },
  "delete":         { "allowed": false, "code": "FORBIDDEN", "message": "Somente a administração pode excluir itens." },
  "registerReturn": { "allowed": false, "code": "FORBIDDEN", "message": "Somente a administração pode registrar devoluções." }
}
```
Calculado no servidor com a lista **completa** de reivindicações. Visitante: `claim` ⇒ `UNAUTHENTICATED` "Entre para reivindicar este item."; `edit`/`delete`/`registerReturn` ⇒ `UNAUTHENTICATED` "Entre na sua conta para continuar.".

### `ItemDetail`
| Campo | Visitante | Usuário comum | Administração |
|---|---|---|---|
| `item` | `PublicItemView` | `Item` completo | `Item` completo |
| `createdBy` | `null` | `PublicUser` do autor | `PublicUser` do autor |
| `myClaims` | `[]` | só as dele, mais recente primeiro | só as dele (admin não reivindica ⇒ `[]`) |
| `claims` | `[]` | `[]` | todas (`ClaimWithClaimant[]`), mais antigas primeiro |
| `returnRecord` | `null` | `null` | `ReturnRecord` se devolvido, senão `null` |
| `viewer` | tudo negado | decisões dele | decisões dele |

Item **devolvido**: visitante recebe **404 `NOT_FOUND`** "Item não encontrado." (igual a item inexistente); usuário logado recebe o detalhe normalmente (somente leitura).

### `GoogleSignInResult`
```json
{ "status": "signed_in", "token": "...", "tokenType": "bearer", "expiresAt": "...", "user": { "...": "User" } }
```
```json
{ "status": "needs_terms", "profile": { "email": "ana@undb.edu.br", "name": "Ana Souza", "affiliation": "institutional" }, "ticket": "eyJ...", "profileToken": "eyJ..." }
```
```json
{ "status": "needs_terms", "profile": { "email": "pessoa@gmail.com", "name": "Pessoa Google", "affiliation": "external" }, "ticket": "eyJ...", "profileToken": "eyJ..." }
```
(`GoogleSignInResult` do contrato ganha `token`/`expiresAt` no ramo `signed_in`, o ramo `needs_terms` com `ticket` no lugar do antigo `needs_role`, que **não existe mais**.)

## 4. Endpoints

Legenda de autenticação: **público** = sem token; **logado** = qualquer papel; **usuário** = `user` (qualquer vínculo); **admin** = `admin`.

### 4.1 Infraestrutura

#### `GET /health` — público
`200 {"status":"ok"}`

#### `GET /catalog` — público
Categorias e locais **demonstrativos** (P5). `locations` são só exemplos do seed: `foundLocation` é texto livre e não é validado contra esta lista. "Outros" é a categoria de "outro tipo" (exige `categoryOther`).
```json
{ "categories": ["Eletrônicos","Documentos","Roupas","Chaves","Outros"], "locations": ["Bloco A","Biblioteca","Cantina","Portaria"],
  "notice": "Categorias e locais de demonstração; os valores finais serão definidos pela equipe." }
```

#### `GET /uploads/{arquivo}` — público
Serve fotos (`/uploads/<uuid>.jpg`) e ilustrações do seed (`/uploads/seed/<arquivo>.svg|webp`). 404 se não existir.

### 4.2 Autenticação

#### `POST /auth/signup` — público
Corpo: `{ "name": "Joana Silva", "email": "joana@exemplo.com", "password": "senha-forte-1", "acceptTerms": true }`
- `name` 2–80 (após trim); `email` válido, até 120, normalizado (trim + minúsculas); `password` pela **política de senha** (§4.2.6), sem trim; **não há campo `role`**: se vier `role` (ou qualquer campo extra) é **ignorado** e a conta nasce `role: user`; o `affiliation` (`institutional` se o domínio do e-mail for um de `GOOGLE_ALLOWED_DOMAINS` ou subdomínio, senão `external`) é derivado do e-mail e gravado na criação (é só o domínio do texto do e-mail: **não** comprova matrícula nem vínculo real). Administração só por `python -m app.create_admin`, convite de admin ou `PATCH /admin/users/{id}` de outro admin; `acceptTerms` deve ser `true` (o servidor grava `termsAcceptedAt` e `termsVersion` = `TERMS_VERSION`). Com Turnstile ligado, também `turnstileToken`.
- A conta **nasce com e-mail não verificado** (`emailVerified: false`, também com e-mail institucional), mas **o cadastro não exige confirmação**: **nenhum e-mail é enviado e nenhum token é emitido** no signup, e a pessoa já pode cadastrar item e reivindicar. A verificação continua disponível por `POST /auth/resend-verification` (§4.2.2). A resposta traz sessão e cookies.
- **Limitação (risco aceito pela equipe, a pedido da usuária)**: sem confirmação, quem cadastra o e-mail de outra pessoa não é impedido de criar conta com ele. Mitigação parcial: o login Google continua **descartando** contas de senha não verificadas do mesmo e-mail (§4.2.1, anti pre-hijack), por isso `email_verified_at` segue nulo no cadastro por senha.
- **201** `Session`.
- Erros: 422 `VALIDATION` ("Informe seu nome.", "Use pelo menos 2 caracteres.", "Use no máximo 80 caracteres.", "Informe seu e-mail.", "Esse e-mail não parece válido. Use o formato nome@exemplo.com.", mensagens de senha do §4.2.6, `fieldErrors.acceptTerms` = "Aceite os termos de uso e a política de privacidade para continuar."); 409 `EMAIL_TAKEN` (`fieldErrors.email` = "Este e-mail já está cadastrado.", sem diferenciar maiúsculas; **revela que o e-mail existe** — escolha de UX herdada do mock); 400 `CAPTCHA_FAILED`.

#### `POST /auth/login` — público
Corpo: `{ "email": "marina@demo.test", "password": "demonstracao123" }` (+ `turnstileToken` se ligado). A senha de login só é limitada a 72 caracteres: contas antigas com senha curta continuam entrando.
- **200** `Session` (+ cookies). Conta não verificada **entra** normalmente.
- **200** `{ "status": "needs_2fa", "challengeToken": "..." }` se a conta tem 2FA ligado: **nenhuma sessão nem cookie ainda**; o cliente pede o código e chama `POST /auth/2fa/verify` (§4.2.7). O mesmo vale para `POST /auth/google` (ramo `signed_in` vira `needs_2fa`).
- 403 `ACCOUNT_DISABLED` se a conta foi desativada (§4.8).
- 401 `INVALID_CREDENTIALS` "E-mail ou senha incorretos." (e-mail inexistente, senha errada, conta só-Google e conta excluída são indistinguíveis).
- 422 `VALIDATION` para formato inválido (não conta como falha de login).
- 429 `RATE_LIMITED` (§4.2.5), 400 `CAPTCHA_FAILED`.

#### `GET /auth/me` — logado
**200** `AccountUser`. Sem credencial ou credencial inválida: 401 (com cookie expirado, o cliente chama `POST /auth/refresh`).

#### `POST /auth/password-strength` — público
Regra de senha reutilizável pela interface (medidor). Corpo: `{ "password": "...", "email"?: "...", "name"?: "..." }`. **200** `{ "ok": false, "score": 1, "label": "Fraca", "error": "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar." }` — `ok` = passa na política; `score` 0–4 (`Muito fraca`, `Fraca`, `Razoável`, `Forte`, `Muito forte`) é só heurística; `error` é `null` quando `ok`. Não grava nem registra a senha. Limite: 600 consultas/h por IP (429).

#### 4.2.1 Google

##### `POST /auth/google` — público (P30)
Corpo: `{ "credential": "<ID token do Google Identity Services>", "acceptTerms"?: true }`
O servidor chama `https://oauth2.googleapis.com/tokeninfo` e confere `aud == GOOGLE_CLIENT_ID`, `iss`, `exp` futuro e `email_verified == true`.
- **Domínio institucional** (exatamente um de `GOOGLE_ALLOWED_DOMAINS`, padrão `undb.edu.br`, ou **subdomínio**; `evilundb.edu.br` e `undb.edu.br.evil.com` **não** contam): ⇒ `affiliation: institutional` na conta nova.
- **Qualquer e-mail Google verificado é aceito**; outro domínio ⇒ `affiliation: external`. Conta existente ⇒ `signed_in` (ou `needs_2fa`); inexistente ⇒ `needs_terms` com `profile` (`email`, `name`, `affiliation`) e `ticket` (JWT de 10 min; nada criado) **até** o cliente repetir a chamada com `acceptTerms: true`, quando a conta é criada e a resposta é `signed_in`. (Desvio deliberado do "cria direto": sem aceite dos termos não se cria conta — LGPD.)
- Contas Google nascem com **e-mail verificado**.
- **Anti pre-hijack**: se já existe conta de **senha não verificada** com esse e-mail (alguém cadastrou o e-mail alheio), ela é **descartada** — senha, sessões e tokens morrem — e a pessoa segue o fluxo normal de conta nova. Conta de senha **verificada** é mantida (e a pessoa entra). Escolha documentada: apagar é mais seguro do que "herdar" uma conta cuja senha outra pessoa conhece.
- **200** `GoogleSignInResult` (+ cookies no `signed_in`).
- 401 `UNAUTHENTICATED` "Não foi possível verificar sua conta Google. Tente novamente." (token recusado, `aud`/`iss`/`exp`/`email_verified` inválidos, e-mail malformado); 422 `VALIDATION` (`fieldErrors.credential`); 502 `UNEXPECTED` (Google inacessível); 503 `UNEXPECTED` "O login com Google não está configurado." (sem `GOOGLE_CLIENT_ID`).

##### `POST /auth/google/complete` — público (exige `ticket` válido)
Corpo: `{ "ticket": "eyJ...", "acceptTerms": true }` (`profileToken` ainda é aceito como nome antigo do `ticket`). Não existe `role`: se vier, é ignorado; a conta nasce `role: user` com `affiliation` pelo domínio do e-mail. `acceptTerms` é obrigatório.
Cria a conta **sem senha**, verificada, com e-mail/nome do token. Sem `ticket` válido (ausente, adulterado, expirado ou token de sessão) não cria nada.
- **201** `Session`.
- 401 `UNAUTHENTICATED` "Sua verificação do Google expirou. Entre com o Google novamente."; 409 `EMAIL_TAKEN`; 422 `VALIDATION` (`fieldErrors.acceptTerms`).

#### 4.2.2 Verificação de e-mail

Links (montados com `APP_BASE_URL`; **rotas do frontend ainda a criar**): `…/verificar-email?token=<token>` e `…/redefinir-senha?token=<token>`. Os tokens têm 256 bits, só o hash SHA-256 fica no banco, são de uso único e de finalidade fixa (um token de verificação não redefine senha e vice-versa).

##### `POST /auth/verify-email` — público
Corpo: `{ "token": "..." }`. **200** `{ "verified": true }` (vale para a sessão que já existia: o próximo `/auth/me` traz `emailVerified: true`). 400 `INVALID_TOKEN` (inexistente, expirado após 24 h, já usado, malformado).

##### `POST /auth/resend-verification` — público
Corpo: `{ "email": "joana@exemplo.com" }` (+ `turnstileToken`). Logado, o corpo pode ser vazio (usa o e-mail da sessão). **202** sempre com o mesmo corpo `{ "status": "accepted", "message": "Se o e-mail estiver cadastrado, enviaremos as instruções em instantes." }`, exista ou não a conta, esteja ou não verificada. O e-mail só sai para conta de senha não verificada; o link anterior é invalidado. Limites: 3 por hora por conta (silencioso, mesma resposta) e 20 pedidos/h por IP (429 `RATE_LIMITED`). 422 só para e-mail malformado.

#### 4.2.3 Sessões por cookie

Cookies definidos nas respostas de sessão (todos `HttpOnly`, `SameSite=Lax`, `Secure` fora de `development`/`test` — ou conforme `COOKIE_SECURE`):

| Cookie | Path | Vida | Conteúdo |
|---|---|---|---|
| `cl_access` | `/` | 15 min | JWT de acesso (mesmo formato do Bearer, preso à sessão). |
| `cl_refresh` | `/` (configurável: `COOKIE_REFRESH_PATH`; `/auth` só serve sem proxy) | 7 dias (renova a cada uso) | Token opaco de uso único; só o hash fica em `sessions`. |

**Atrás de um proxy same-origin do Next** (ex.: o frontend chama `/backend/auth/refresh` e o Next repassa à API): o navegador só envia um cookie cujo `Path` é prefixo da URL vista por ele (`/backend/auth/...`), então `Path=/auth` nunca seria enviado. Configuração recomendada nesse caso:

```
COOKIE_REFRESH_PATH=/          # cookie de refresh enviado a qualquer rota do site (padrão; `/auth` serve só sem proxy)
COOKIE_SECURE=true             # HTTPS em produção (vazio já liga fora de development/test; false só em HTTP local)
CORS_ORIGINS=https://app.exemplo.edu.br   # a origem do SITE (a que o navegador envia em `Origin`), não a da API
```

Os cookies não têm `Domain`: ficam presos ao host do site e passam pelo proxy sem ajuste (o Next repassa `Set-Cookie`). O CSRF (§1) continua valendo: `Origin` é a do site, que está em `CORS_ORIGINS`, e o `fetch` deve mandar `X-Requested-With`. Com `Path=/` o refresh também vai em chamadas que não precisam dele; é o preço do proxy. Sem proxy (frontend e API em origens diferentes chamando direto), mantenha `/auth`. Valor inválido (sem `/` inicial) impede a API de subir. Não foi testado com um Next real, só com `Origin`/cookies simulados nos testes.

Cookie de acesso **inválido/expirado** é tratado como visitante (a navegação pública não quebra); `/auth/me` e rotas protegidas respondem 401 e o cliente chama `refresh`. Mutáveis por cookie: ver CSRF na §1.

##### `POST /auth/refresh` — cookie `cl_refresh`
Troca o refresh por um par novo (**rotação**: o antigo morre). **200** `Session` (+ cookies novos). 401 `UNAUTHENTICATED` se o cookie falta, expirou (7 dias sem uso), foi revogado ou **já foi usado**: reapresentar um refresh antigo (fora de 10 s de tolerância para duas abas renovando juntas) é tratado como roubo e **revoga a sessão inteira**. 403 `CSRF_FAILED` sem `X-Requested-With`.

##### `POST /auth/logout` — Bearer e/ou cookies
Revoga a sessão do Bearer enviado e a dos cookies, e limpa os cookies. **204**, sempre (idempotente, funciona com o acesso expirado). Com cookies e sem Bearer exige `X-Requested-With` (403 `CSRF_FAILED`).

#### 4.2.4 Recuperação de senha

##### `POST /auth/forgot-password` — público
Corpo: `{ "email": "..." }` (+ `turnstileToken`). **202** sempre com o corpo genérico acima. Se a conta existe, envia link (1 h, uso único; pedido novo invalida o anterior; 3 por hora por conta, silencioso). 422 só para e-mail malformado; 429 por IP.

##### `POST /auth/reset-password` — público
Corpo: `{ "token": "...", "password": "..." }`. **200** `{ "status": "ok", "message": "Senha redefinida. Entre com a nova senha." }`. A senha nova passa pela política (§4.2.6, incluindo "não igual ao e-mail/nome"); se for recusada, 422 `fieldErrors.password` e o **token não é gasto**. Efeitos: **todas as sessões e tokens de acesso anteriores caem** (Bearer inclusive), tokens de e-mail abertos são encerrados, o bloqueio de login do e-mail é limpo e o e-mail passa a **verificado** (quem recebe o link prova controlar a caixa — também desfaz um pre-hijack por senha). 400 `INVALID_TOKEN`.

#### 4.2.5 Limite de tentativas de login

Persistido na tabela `login_attempts` (chave: e-mail normalizado + IP; sobrevive a reinício). Só **falhas** contam. `LOGIN_RATE_LIMIT` (10) falhas bloqueiam por `LOGIN_RATE_WINDOW_SECONDS` (60 s); cada nova falha depois do bloqueio bloqueia de novo com o dobro (2 min, 4 min… até 1 h). Enquanto bloqueado, **mesmo a senha certa** recebe 429 `RATE_LIMITED` com `Retry-After` (a senha nem é conferida). Zera com login bem-sucedido, após 15 min sem falhas (contados do fim do bloqueio) ou ao redefinir a senha. Atrás de proxy, o IP vem de `request.client`: rode o uvicorn com `--proxy-headers --forwarded-allow-ips=<proxy>`.

**Turnstile (opcional)**: com `TURNSTILE_SECRET` definido, `signup`, `login`, `forgot-password` e `resend-verification` exigem `turnstileToken` (token do widget Cloudflare) no corpo; sem ele ou se for recusado, 400 `CAPTCHA_FAILED`. Vazio = desligado.

#### 4.2.6 Política de senha (senhas **novas**: signup e reset)

Mínimo **10 caracteres**; no máximo **72 bytes em UTF-8** (limite técnico: a interface **não fala em bytes**, mostra "Use pelo menos 10 caracteres. Evite senhas comuns." e, para senha longa, "A senha é longa demais. Use uma senha mais curta.") (limite do bcrypt: recusa em vez de truncar; "é" vale 2 bytes, emoji 4); não pode estar na lista de senhas comuns (~300 entradas em `backend/app/rules/common_passwords.txt`, também com sufixo/prefixo numérico ou simbólico: `Password1234`), nem ser composta de 1–2 caracteres repetidos ou sequência óbvia, nem igual ao e-mail, à parte local do e-mail ou ao nome. Mensagens (`fieldErrors.password`): "Crie uma senha." · "Use pelo menos 10 caracteres." · "Use no máximo 72 caracteres." · "A senha passa de 72 bytes (acentos e emojis ocupam mais de 1 byte). Use uma senha mais curta." · "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar." · "A senha não pode ser igual ao seu e-mail ou ao seu nome." · "Evite repetições e sequências óbvias (como aaaaaaaaaa ou 1234567890)."

#### 4.2.7 Verificação em duas etapas (TOTP, RFC 6238)

SHA-1, 6 dígitos, passo de 30 s, tolerância de ±1 passo; um código **não vale duas vezes** (o último passo aceito é guardado). Implementado com `hmac`/`hashlib`/`base64`, sem dependência nova (testado com os vetores da RFC). Todas as rotas abaixo exigem sessão (exceto `verify`).

- `POST /auth/2fa/setup` → **200** `{ "secret": "<base32, 32 car.>", "otpauthUri": "otpauth://totp/CampusLost%3Aemail?secret=...&issuer=CampusLost&algorithm=SHA1&digits=6&period=30" }`. O segredo fica pendente (inativo) até `enable`; chamar de novo troca o pendente. 409 `CONFLICT` se o 2FA já está ativo. O cliente desenha o QR a partir do `otpauthUri`.
- `POST /auth/2fa/enable` `{ "code": "123456" }` → **200** `{ "enabled": true, "recoveryCodes": ["abcde-fghjk", ... 8 códigos] }`. Os códigos de recuperação aparecem **só nesta resposta** (no banco só o hash SHA-256) e valem uma vez cada. Código errado: 422 `VALIDATION` `fieldErrors.code`. 409 sem `setup` prévio ou já ativo.
- `POST /auth/2fa/disable` `{ "password": "...", "code": "123456" }` → **200** `{ "enabled": false }`. `code` aceita um TOTP atual **ou** um código de recuperação; `password` é exigido se a conta tiver senha (conta só-Google confirma só com o código). Falha: 403 `INVALID_CREDENTIALS` (`fieldErrors.password`). Apaga segredo e códigos de recuperação.
- `POST /auth/2fa/verify` `{ "challengeToken": "...", "code": "123456" }` ou `{ "challengeToken": "...", "recoveryCode": "abcde-fghjk" }` → **200** `Session` (+ cookies). O `challengeToken` é um JWT de 5 min (`typ` próprio; não serve como Bearer). Código errado: 401 `INVALID_CREDENTIALS` com `fieldErrors.code`; desafio inválido/expirado: 401 `UNAUTHENTICATED` "A verificação expirou. Entre novamente."
- **Limite de tentativas**: `setup`/`enable`/`disable`/`verify` usam o mesmo mecanismo do login (§4.2.5) com chave própria por conta + IP: 10 erros bloqueiam (429 `RATE_LIMITED`, `Retry-After`, progressivo) e, bloqueado, nem o código certo passa.
- **Administração exige 2FA.** Admin sem 2FA consegue entrar, mas toda rota `/admin/*` responde **403 `TWO_FACTOR_REQUIRED`** até ele concluir `setup` + `enable`. **Isenções** (configuração `ADMIN_REQUIRE_2FA`): vazia = exigido, **exceto com `DEMO_MODE=true`**; `false` desliga; `true` liga mesmo em demo (a conta `user-admin` do seed continua isenta em modo demo, para a demonstração funcionar).
- **Escopo da exigência**: vale para `/admin/*` **e** para todas as rotas só-admin: `GET /items/{id}/claims`, `GET /claims/pending`, `POST /claims/{id}/accept|reject`, `PUT|DELETE /items/{id}`, `POST /items/{id}/return` e `GET /returns` (mesma regra e mesmas isenções; papel errado continua 403 `FORBIDDEN`, a checagem de 2FA vem depois). Rotas que o admin usa como qualquer papel (`GET /items`, `POST /items`, `/me/*`) não são bloqueadas. O frontend deve tratar `TWO_FACTOR_REQUIRED` em todo o painel e levar o admin ao `setup`.
- **Limitação**: o segredo TOTP fica **em claro** na coluna `users.totp_secret` (não há biblioteca de cifra no projeto e não implementamos cifra caseira). Quem lê o arquivo do banco ou um backup consegue gerar códigos: proteja `data/` e `data/backups/`.
- Perda do dispositivo: use um código de recuperação. Sem eles não há redefinição self-service (decisão em aberto; um admin não consegue zerar o 2FA de outra pessoa nesta versão).

#### 4.2.8 Aceitar convite de administração

##### `POST /auth/accept-invite` — público
Corpo: `{ "token": "<do e-mail>", "name": "Nome Completo", "password": "..." }`. Nome 2–80; senha pela política do §4.2.6 (não pode ser igual ao e-mail do convite). **201** `Session` de uma conta `admin` com e-mail **verificado** (o link chegou à caixa de entrada). Uso único; vale 48 h (`INVITE_TOKEN_HOURS`); revogado ou reemitido para o mesmo e-mail = inválido. Erros: 400 `INVALID_TOKEN`, 422 `VALIDATION`, 409 `EMAIL_TAKEN` (alguém se cadastrou com o e-mail depois do convite), 429 (por IP, junto dos pedidos de e-mail). A conta nasce **sem 2FA**: não há exigência no primeiro uso, mas `/admin/*` responde `TWO_FACTOR_REQUIRED` até ela ativar (§4.2.7). Não grava aceite de termos (o convite não os apresenta): `termsAcceptedAt` fica nulo.

### 4.3 Itens

#### `GET /items` — público (P26)
Query (todos opcionais; valor vazio é ignorado): `category` (uma de `/catalog`), `location` (**texto livre**, até 120: itens cujo `foundLocation` CONTÉM o texto, sem diferenciar maiúsculas/minúsculas nem acentos; vazio é ignorado), `from` e `to` (`YYYY-MM-DD`, inclusivos, sobre `foundDate` — P11), `status` (`available`|`under_claim`; `returned` é inválido), `sort` (`registered` padrão = mais recentemente registrado primeiro; `found` = mais recentemente encontrado primeiro). Filtros combinam (E). **Itens devolvidos nunca aparecem.** Desempate: o outro critério e depois o `id`.
- **200** `ItemView[]` (`storedAt` só para administração ou para o ator com reivindicação aceita naquele item aguardando devolução; visitante também sem `createdById`). A busca por `location` considera apenas `foundLocation`, nunca `storedAt`.
- 422 `VALIDATION`: "Categoria inválida.", "Use no máximo 120 caracteres." (`location`), "Situação inválida.", "Ordenação inválida.", "Informe uma data válida." (`from`/`to`), "A data final deve ser igual ou posterior à inicial." (em `to`).

#### `GET /items/{id}` — público (P26)
**200** `ItemDetail`. 404 `NOT_FOUND` (inexistente; ou devolvido para visitante).

#### `POST /items` — qualquer logado (user/admin)
`multipart/form-data` com os campos de texto abaixo e `photo` opcional (arquivo).

| Campo | Regra |
|---|---|
| `title` | 3–80 (trim) |
| `description` | 10–500 |
| `category` | uma de `/catalog` ("Escolha uma categoria.") |
| `categoryOther` | obrigatório **somente** com `category=Outros` (3–40, trim; vazio: "Especifique a categoria."). Com outra categoria o valor enviado é ignorado e gravado `null` |
| `foundLocation` | texto livre, 3–120 (trim; "Informe o local onde foi encontrado.", "Use pelo menos 3 caracteres.", "Use no máximo 120 caracteres.") |
| `foundDate` | `YYYY-MM-DD` válida, não futura ("Informe a data.", "Informe uma data válida.", "A data não pode ser no futuro.") |
| `storedAt` | **obrigatório**, texto 3–120 (trim; "Informe onde o item está guardado.", "Use pelo menos 3 caracteres.", "Use no máximo 120 caracteres."). Só quem a regra de visibilidade permite o lê de volta; o autor comum não |
| `photo` | opcional. JPEG, PNG ou WebP **identificado pelo conteúdo** (assinatura do arquivo; extensão e `Content-Type` declarados são ignorados), até 10 MB. Parte de arquivo vazia e sem nome (navegador sem arquivo escolhido) = sem foto |

Campos extras (`status`, `createdById`, `photoUrl`…) são ignorados: o item nasce `available`, com `createdById` = usuário do token.
- **201** `Item` (segue a regra de `storedAt`: o autor comum não recebe `storedAt` de volta).
- 401/403; 422 `VALIDATION` (campos) **antes** de `PHOTO_INVALID`: "Formato não aceito. Use JPG, PNG ou WebP.", "O arquivo está vazio.", "A foto passa de 10 MB. Escolha uma menor."; 413 se o corpo passar de 11 MB.

Exemplo (curl):
```bash
curl -X POST http://127.0.0.1:8000/items -H "Authorization: Bearer $TOKEN" \
  -F title="Agenda vermelha" -F description="Agenda vermelha com elástico e capa dura." \
  -F category=Outros -F categoryOther="Agenda" -F "foundLocation=Bloco C, segundo andar" -F foundDate=2026-10-21 \
  -F "photo=@agenda.png;type=image/png"
```

#### `PUT /items/{id}` — admin
Mesmos campos de `POST /items`, mais `removePhoto` (`true`/`1`/`on`). Foto: arquivo novo substitui (e apaga o arquivo antigo); sem arquivo mantém; `removePhoto=true` sem arquivo remove (arquivo novo vence `removePhoto`). O status do item não muda.
- **200** `Item` (admin: inclui `storedAt`, obrigatório como no registro; vazio → 422 "Informe onde o item está guardado."). Ordem de erros: 401 → 404 → 403 `FORBIDDEN` "Somente a administração pode editar itens." → 409 `ITEM_RETURNED` "Itens devolvidos não podem ser editados." → 422.

#### `DELETE /items/{id}` — admin
**204**. Remove também as reivindicações do item (P18) e o arquivo da foto enviada (nunca as ilustrações do seed). Erros: 404; 403 "Somente a administração pode excluir itens."; 409 `ITEM_RETURNED` "Itens devolvidos não podem ser excluídos.".

### 4.4 Reivindicações

#### `POST /items/{id}/claims` — `user`
Corpo: `{ "proofDetails": "Tem um adesivo azul na parte de trás.", "lostWhereWhen": "Biblioteca, ontem de manhã." }` — `proofDetails` 10–500, `lostWhereWhen` 5–300 (trim). Item `available` passa a `under_claim`.
- **201** `Claim` (`status: "pending"`).
- 422 `VALIDATION` (primeiro, antes da checagem de sessão); 401; 403 (admin: "Você não tem permissão para realizar esta ação."); 404 item; e as decisões de `viewer.claim`: 409 `ITEM_RETURNED` "Este item já foi devolvido."; 409 `DUPLICATE_CLAIM` ("Sua reivindicação foi aceita. Procure a administração para retirar o item." / "Você já tem uma reivindicação em andamento para este item."); 403 `FORBIDDEN` para o cadastrante do item (mensagem acima; checada depois de sessão/capacidade/e-mail e antes de status e reivindicações; identidade só da sessão e do banco, `claimantId`/`createdById` no corpo são ignorados); 409 `CLAIM_BLOCKED` ("Sua reivindicação para este item foi recusada. Procure a administração." / "Este item já tem uma reivindicação aceita e aguarda a devolução." — P14).

#### `GET /items/{id}/claims` — admin
**200** `ClaimView[]`, mais antigas primeiro. 404 se o item não existir.

#### `GET /claims/mine` — `user`
**200** `ClaimView[]`, mais recentes primeiro (inclui reivindicações de itens depois devolvidos). Admin: 403.

#### `GET /claims/pending` — admin
**200** `ClaimView[]` só `pending`, mais antigas primeiro (P17).

#### `GET /claims/{id}` — o autor ou admin
**200** `ClaimView`. 404 "Reivindicação não encontrada."; 403 "Você não tem permissão para ver esta reivindicação.".

#### `POST /claims/{id}/accept` e `POST /claims/{id}/reject` — admin
Sem corpo. **200** `ClaimDecisionResult`:
```json
{ "claim": { "id": "claim-01", "status": "accepted", "reviewedAt": "2026-10-22T15:00:00.000Z", "...": "Claim" },
  "item": { "id": "item-03", "status": "under_claim", "...": "Item" },
  "autoRejectedIds": ["claim-02"] }
```
- **Aceitar** recusa automaticamente as demais pendentes do item (`autoRejectedIds`); o item continua `under_claim`.
- **Recusar**: se não restar reivindicação pendente/aceita, o item volta a `available`.
- Uma aceita não se desfaz (P15). Erros: 404; 403 "Somente a administração pode analisar reivindicações."; 409 `ITEM_RETURNED`; 409 `INVALID_TRANSITION` "Esta reivindicação já foi analisada." / "O item não está em reivindicação.".

### 4.5 Devoluções

#### Código de retirada (confirmação presencial da devolução)
A devolução exige um **código que só o proprietário confirmado obtém na própria conta** e informa pessoalmente. Fluxo: (1) o dono gera o código (`POST /claims/{id}/return-code`); (2) a administração o digita e o backend confere (`.../verify`); (3) só então a administração confirma a entrega (`POST /items/{id}/return`). Conferir o código **não** devolve o item; não há atalho para a administração registrar sem código válido.

- **Geração na conta do dono, não na aprovação**: aceitar uma reivindicação não gera nem devolve código; recusada/pendente não têm código. Gerar de novo **substitui** o anterior (o antigo deixa de valer e a conferência feita é zerada); falhas e bloqueio permanecem (**regenerar não destrava**).
- **Formato**: 8 caracteres aleatórios (CSPRNG) de `23456789ABCDEFGHJKMNPQRSTVWXYZ` (sem 0/O/1/I/L/U), exibido `XXXX-XXXX`. Na entrada, espaços e hífens são removidos e as letras vão para maiúsculas (`k7m2 9qxb` = `K7M2-9QXB`).
- **Armazenamento**: só o HMAC-SHA256 (chave derivada de `SECRET_KEY` + contexto fixo; mensagem = id da reivindicação + código), exclusivo de cada reivindicação; comparação em tempo constante. Tabela `return_codes` (uma linha por reivindicação).
- **Privacidade**: o texto puro aparece **somente** na resposta de `POST .../return-code`, que sai com `Cache-Control: no-store`. Nunca em GET, listas, JSON de claim/item/return, auditoria, log nem mensagem de erro; a administração nunca o vê. O corpo do `verify` não é registrado por nenhum middleware.
- **Limites** (`Settings`/env, valores padrão): `RETURN_CODE_MAX_ATTEMPTS=5` falhas, `RETURN_CODE_LOCK_SECONDS=900` de bloqueio, `RETURN_CODE_VERIFY_TTL_SECONDS=900` de validade da conferência (entre conferir e confirmar a entrega). O bloqueio é por reivindicação (não por IP/admin), persistido no banco; a escrita é serializada (`write_lock`), então tentativas simultâneas não passam do limite.

##### `POST /claims/{claimId}/return-code` — só o solicitante
Sem corpo. Exige conta de usuário (e-mail confirmado não é exigido), `claim.claimantId == sessão` (nunca vem do corpo), reivindicação `accepted` e item `under_claim`.
- **200** `{ "code": "K7M2-9QXB", "issuedAt": "2026-10-22T15:00:00.000Z" }` (`Cache-Control: no-store`).
- 401; 403 `FORBIDDEN` (outro usuário, criador do item, admin: "Somente quem fez a reivindicação aceita pode gerar o código de retirada." / mensagem genérica para admin); 404 reivindicação inexistente; 409 `INVALID_TRANSITION` "Só reivindicações aceitas, de itens aguardando devolução, têm código de retirada." (pendente, recusada ou item devolvido).

##### `GET /claims/{claimId}/return-code` — dono ou administração
**Nunca devolve o código.** Dono: `{ "issued": bool, "issuedAt": ISO|null }`. Administração (2FA como nas demais rotas admin): `{ "issued", "issuedAt", "verified": bool, "verifiedAt": ISO|null, "verifiedUntil": ISO|null, "attemptsLeft": int, "lockedUntil": ISO|null }` — `verified` só é `true` dentro da validade e com o código ainda não usado; `attemptsLeft` é `0` durante o bloqueio; `lockedUntil` só existe enquanto bloqueado. 401; 403 (qualquer outro usuário); 404.

##### `POST /claims/{claimId}/return-code/verify` — admin
Corpo `{ "code": "K7M2-9QXB" }`. **200** = status de administração (acima) com `verified: true`.
- Ordem: 401/403 (papel, 2FA) → 404 → 409 `ITEM_RETURNED` (item já devolvido) / 409 `INVALID_TRANSITION` (reivindicação não aceita ou item fora de `under_claim`: "Só reivindicações aceitas, de itens aguardando devolução, têm código de retirada."; código não gerado: "A pessoa ainda não gerou o código de retirada. Peça para ela gerar em Minhas reivindicações."; já usado) → 429 bloqueio → 422 entrada.
- **422** `VALIDATION`: vazio ou não texto → `fieldErrors.code` "Informe o código de retirada." (**não** conta tentativa); código incorreto (inclui formato inválido não vazio) → `fieldErrors.code` "Código incorreto. Restam {k} tentativa(s).", conta uma falha.
- **429** `RATE_LIMITED` com `Retry-After` (segundos): na falha que atinge o máximo (o contador zera e o bloqueio começa) e em toda tentativa durante o bloqueio, mesmo com o código certo: "Muitas tentativas incorretas. Aguarde {n} minuto(s) para tentar de novo.". Passado o bloqueio, volta a valer com tentativas cheias.
- Sucesso: `verifiedAt=agora` (ator = admin da sessão), zera falhas.

#### `POST /items/{id}/return` — admin
Sem corpo. Exige reivindicação aceita **e código de retirada conferido** (dentro da validade e não usado); o destinatário é o autor dela (P19); item → `returned` (irreversível). Na mesma transação: cria a devolução, marca o código como usado e grava a auditoria (tudo ou nada); duplo clique/requisições concorrentes geram exatamente uma devolução (a outra recebe 409 `ITEM_RETURNED`).
- **201** `ReturnView` (agora com `"codeVerifiedAt": ISO|null` — `null` em devoluções legadas, anteriores ao código; só na visão administrativa `ReturnView`, não em `ReturnRecord`).
- 404; 403 "Somente a administração pode registrar devoluções."; 409 `ITEM_RETURNED` "Este item já foi devolvido."; 409 `INVALID_TRANSITION` "Só é possível devolver um item que está em reivindicação." / "Aceite uma reivindicação antes de registrar a devolução." / **"Valide o código de retirada antes de confirmar a entrega."** (código não gerado ou não conferido) / **"A conferência do código expirou. Valide o código novamente."** / "Este código de retirada já foi usado.".
- `viewer.registerReturn` (detalhe do item) continua refletindo só papel/estado do item; a exigência do código é checada ao registrar.

#### `GET /returns` — admin
Query: `from`, `to` (`YYYY-MM-DD`, inclusivos, sobre a **data local** de `returnedAt`). **200** `ReturnView[]`, mais recentes primeiro. 422 como em `GET /items` (datas/período).

### 4.6 LGPD — dados da própria conta (logado, qualquer papel)

#### `GET /me/export`
**200** JSON (com `Content-Disposition: attachment; filename="campuslost-meus-dados.json"` e `Cache-Control: no-store`):
```json
{ "format": "campuslost-export-v1", "exportedAt": "...",
  "account": { "id": "...", "name": "...", "email": "...", "role": "...", "provider": "password", "createdAt": "...", "emailVerifiedAt": "..."|null, "termsAcceptedAt": "..."|null, "termsVersion": "2026-10"|null },
  "itemsRegistered": [ "Item" ], "claims": [ "Claim + itemTitle" ], "returns": [ "ReturnRecord + role: returnedTo|registeredBy" ],
  "sessions": [ { "id": "...", "createdAt": "...", "expiresAt": "...", "revokedAt": "..."|null } ] }
```
Nunca inclui hash de senha nem tokens. 401 sem sessão.

#### `DELETE /me`
Exclui (**anonimiza**) a conta. Corpo de confirmação: conta com senha ⇒ `{ "password": "..." }`; conta só-Google ⇒ `{ "credential": "<ID token Google recente>" }` (verificado de novo no Google; o e-mail precisa ser o da conta). **204** (cookies limpos).
- A linha do usuário permanece para preservar a integridade: `name` = "Usuário removido", e-mail = `removido-<id>@excluido.invalid` (o e-mail original fica livre para novo cadastro), sem senha, `provider: "deleted"`, `deletedAt`; sessões e tokens apagados; tokens de acesso antigos dão 401.
- **Itens** cadastrados ficam, com o autor anônimo. **Reivindicações** em aberto (pendentes ou aceitas e não devolvidas) viram `rejected` e o item volta a `available` se não restar outra ativa; os textos `proofDetails`/`lostWhereWhen` de todas as reivindicações da pessoa são substituídos por "[Conteúdo removido a pedido do titular dos dados]". Devoluções já registradas permanecem.
- Erros: 403 `INVALID_CREDENTIALS` com `fieldErrors.password` ("Confirmação incorreta.") — conta como falha de login (429 após 10); 401 se o ID token Google for recusado; 409 `CONFLICT` para a **única** conta de administração.
- Não coberto: backups e logs do servidor; cópia exportada pela própria pessoa.

### 4.7 Demonstração (só com `DEMO_MODE=true`; senão 404 `NOT_FOUND`)

#### `GET /demo/profiles` — público
```json
[ { "key": "user", "label": "Usuário", "user": { "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "user" } },
  { "key": "admin", "label": "Administração", "user": { "id": "user-admin", "...": "..." } } ]
```

#### `POST /demo/login/{key}` — público
`key`: `user` (Marina, `user` + `institutional`) | `admin`. **200** `Session` (+ cookies). 404 para qualquer outra chave (inclusive `institutional`, `external`, `student`, `teacher`). As chaves são atalhos de demonstração, não papéis nem vínculos. `externo@demo.test` (`user` + `external`, "Visitante Externo" na API e "Camila Torres" no mock), Rafael e os demais **não têm atalho**: entram por `POST /auth/login` com a senha de demonstração.

#### `POST /demo/reset` — público
Restaura o seed (datas relativas a hoje) e apaga as fotos enviadas. **204**. Tokens (e sessões) dos usuários do seed continuam válidos; os de usuários criados depois passam a dar 401.

### 4.8 Administração (`/admin/*`) — admin com 2FA (§4.2.7)

Sem sessão: 401; papel diferente de `admin`: 403 `FORBIDDEN`; admin sem 2FA: 403 `TWO_FACTOR_REQUIRED`. Listas paginadas devolvem `{ "items": [...], "page": 1, "pageSize": 20, "total": 57, "totalPages": 3 }`; `?page=` (≥ 1) e `?pageSize=` (1–100, padrão 20) inválidos ⇒ 422.

#### `GET /admin/audit` — trilha de auditoria
Filtros: `?action=` (exato), `?actor=` (id do usuário), `?page=`, `?pageSize=`. Mais recentes primeiro. Cada item: `{ id, at, actorId|null, actorName|null, action, targetType|null, targetId|null, ip|null, metadata|null }`. `metadata` nunca contém senha, token, segredo TOTP nem código (as chaves com esses nomes são descartadas na gravação — única exceção: o indicador booleano `codeVerified`; falhas de login guardam só `emailRef`, 12 hex de um SHA-256 do e-mail digitado).

| `action` | Quando | `target` | `metadata` |
|---|---|---|---|
| `login.success` | Login concluído (senha, Google ou 2FA) | user | `method` (`password`/`google`/`2fa`), `second` |
| `login.failure` | Senha errada, conta desativada, código 2FA errado no login | user (se existir) | `method`, `reason`, `emailRef` |
| `login.blocked` | Tentativa recusada por 429 | — | `emailRef` |
| `logout` | Sessão revogada por `POST /auth/logout` | session | — |
| `signup` | Cadastro (senha ou Google) | user | `role`, `affiliation`, `provider` |
| `email.verify` | Confirmação de e-mail | user | — |
| `password.reset` | Senha redefinida por link | user | — |
| `user.role_change` | `PATCH /admin/users/{id}` mudou o papel | user | `from`, `to` |
| `user.disable` / `user.enable` | Desativação / reativação | user | — |
| `claim.accept` / `claim.reject` | Decisão sobre reivindicação | claim | `itemId`, `autoRejected` |
| `return.register` | Devolução registrada | item | `returnId`, `claimId`, `codeVerified` (sempre `true`) |
| `return_code.issue` | Dono gerou (ou regenerou) o código de retirada | claim | `itemId` |
| `return_code.verify` | Administração conferiu o código | claim | `itemId` |
| `return_code.failure` | Código incorreto na conferência | claim | `itemId`, `attemptsLeft` |
| `return_code.locked` | Limite de falhas atingido; conferência bloqueada | claim | `itemId`, `lockedSeconds` |
| `item.delete` | Item excluído | item | `title`, `status` |
| `account.delete` | Conta excluída (LGPD, `DELETE /me`) | user | — |
| `2fa.enable` / `2fa.disable` / `2fa.failure` | Ligado / desligado / código errado em `enable` ou `disable` | user | `stage`, `with` |
| `invite.create` / `invite.revoke` / `invite.accept` | Convites de administração | invite | `emailRef` |

O registro não tem chave estrangeira (sobrevive a contas removidas). A limpeza não apaga auditoria por padrão (`python -m app.maintenance --audit-days N` apaga a mais antiga que N dias). Não cobre: edição de item (`PUT /items/{id}`), criação de item/reivindicação, e leituras.

#### `GET /admin/users` — usuários
Filtros: `?q=` (trecho do nome ou e-mail, sem distinguir maiúsculas; `%` e `_` são literais), `?role=user|admin`, `?affiliation=institutional|external`, `?status=active|disabled`. Contas excluídas (LGPD) não aparecem. Item: `{ id, name, email, role, affiliation, provider, active, disabledAt|null, emailVerified, twoFactorEnabled, createdAt }` (nunca hash nem segredo).

#### `PATCH /admin/users/{id}`
Corpo: `{ "role": "admin" }` (`user` | `admin`) e/ou `{ "active": false }`. **200** o usuário atualizado. Desativar (`active:false`): `disabledAt` é gravado, **todas as sessões são revogadas e os tokens de acesso emitidos caem** (próxima chamada ⇒ 401), e o login passa a responder 403 `ACCOUNT_DISABLED`; `active:true` reativa (a pessoa precisa entrar de novo). Erros: 422 (`role` fora da lista, `active` não booleano, corpo vazio), 404, **409 `CONFLICT`** ao mexer na própria conta ou ao rebaixar/desativar o último admin ativo. Registra `user.role_change` / `user.disable` / `user.enable`.

#### Convites de administração
- `POST /admin/invites` `{ "email": "nova@undb.edu.br" }` → **201** `{ id, email, status:"pending", createdAt, expiresAt, invitedById }`. Gera token aleatório (256 bits), guarda só o hash, vale **48 h**, uso único, e envia o link `APP_BASE_URL/aceitar-convite?token=...` pelo mailer em segundo plano (com `MAIL_BACKEND=console` o link aparece no log). **O token nunca é devolvido pela API.** Um novo convite para o mesmo e-mail revoga o anterior. 409 `EMAIL_TAKEN` se já existe conta com o e-mail.
- `GET /admin/invites` → lista paginada; `status` ∈ `pending | accepted | revoked | expired`.
- `DELETE /admin/invites/{id}` → **204**; revoga (idempotente). 404 se não existe; 409 se já foi aceito.
- Quem recebe usa `POST /auth/accept-invite` (§4.2.8).

## 5. Dados de demonstração (seed)

Contas `*@demo.test`, senha **`demonstracao123`** (pública): `marina@` (`user-marina`), `rafael@` (`user-rafael`), `lucas@`, `beatriz@` — todas `role: user`, `affiliation: institutional` (gravado explicitamente, apesar do domínio `@demo.test`); `externo@` (`user-externo`): `user` + `external`; `admin@` (`user-admin`): `admin` + `institutional`. Todas já com e-mail verificado. 11 itens (`item-01`…`item-11`; `item-10` e `item-11` devolvidos), 9 reivindicações, 2 devoluções, mesmos ids, textos e datas relativas ao mock (`frontend/src/services/mock/seed.ts`). Fotos: `/uploads/seed/<arquivo>.svg|webp`. Locais de encontro e de guarda do seed são texto de exemplo; todos os itens "Outros" do seed têm `categoryOther` (ex.: "Mochila escolar", "Garrafa térmica", "Guarda-chuva", "Óculos de grau"); o carregador (`item-11`) segue em "Eletrônicos", sem detalhe.

**Migração Alembic `0004`** (`item_free_location_other_category`; `alembic upgrade head`): `items.found_location` 40→120, nova coluna `items.category_detail` (40, NULL). `items.stored_at` **continua NOT NULL** (a 0004 não o altera). Nenhum dado é alterado ou apagado. Bancos antigos sem `items.category_detail` são acusados pela checagem de esquema da subida. Downgrade: `found_location` é truncado a 40 caracteres e `category_detail` é descartado.

## 6. Diferenças em relação ao mock (para o cliente tratar)

1. **Sessão**: o mock guarda `userId` em `sessionStorage`. O cliente REST do frontend **não guarda token**: usa os cookies HttpOnly (§4.2.3) por meio do proxy same-origin `/backend`; o `token` do corpo da resposta é ignorado. Num 401 `UNAUTHENTICATED` o cliente tenta uma vez `POST /auth/refresh` e repete a chamada; se falhar, encerra a sessão local. O logout chama `POST /auth/logout`.
2. **`getCurrentUser`**: a API responde 401 sem sessão; o cliente converte em `null`.
3. **Google**: `signInWithGoogle` recebe `credential` (não o perfil) e `completeGoogleSignUp` recebe `ticket` + `acceptTerms` (sem `role`). A rota `/api/auth/google` do Next deixa de ser necessária.
4. **`subscribe`**: não existe push. Releitura manual/periódica.
5. **Foto**: `photoUrl` (caminho relativo à API) no lugar de `photoDataUrl`; upload em `multipart`; sem redimensionamento no servidor.
6. **Códigos novos** que o tipo `ServiceErrorCode` do frontend ainda não tem: `RATE_LIMITED`, `CSRF_FAILED`, `INVALID_TOKEN`, `CAPTCHA_FAILED`, `ACCOUNT_DISABLED`, `TWO_FACTOR_REQUIRED`. Também novos: `role` reduzido a `user|admin` e `affiliation` (`institutional|external`) em `AccountUser`, `emailVerified` no usuário da sessão, `acceptTerms` no cadastro e o ramo `needs_terms` do Google.
7. **Latência/falha simulada** do mock não existem; erros de rede são `NETWORK` no cliente.
8. **Concorrência**: o servidor serializa as escritas (um processo); duas reivindicações simultâneas do mesmo usuário no mesmo item resultam em uma 201 e uma 409 `DUPLICATE_CLAIM`.
9. **Local livre e `storedAt`**: `foundLocation` deixa de ser enum (texto 3–120); `categoryOther` é novo; `storedAt` é obrigatório e só vem para administração ou reivindicante aceito com item aguardando devolução (a chave é omitida para os demais e para visitante, inclusive no item embutido de reivindicações e no export de dados).
10. **`createdBy`** continua no `ItemDetail` do visitante como `null` (contrato), sem nenhum dado do autor.

## 7. Cabeçalhos de segurança no Next (recomendação; arquivo do frontend)

O backend só protege as respostas da API. A página do Next deve enviar os próprios cabeçalhos; `frontend/next.config.ts` é do frontend, então aqui vai apenas o snippet sugerido (**não testado** contra o build do projeto; ajuste `connect-src` à URL real da API e libere `https://challenges.cloudflare.com` e `https://accounts.google.com` somente se Turnstile/Google estiverem ligados):

```ts
// next.config.ts (trecho)
const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const csp = [
  "default-src 'self'",
  `connect-src 'self' ${api}`,
  `img-src 'self' data: blob: ${api}`,
  "style-src 'self' 'unsafe-inline'",           // Next/Tailwind injetam estilos
  "script-src 'self' 'unsafe-inline'",           // produção: trocar por nonce (middleware) se possível; dev precisa de 'unsafe-eval'
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }, // só em HTTPS de produção
      ],
    }];
  },
};
```

Notas: `script-src 'unsafe-inline'` enfraquece a CSP contra XSS; o ideal é CSP com nonce via middleware do Next. `frame-ancestors 'none'` e `X-Frame-Options: DENY` evitam clickjacking. O HSTS só deve ir ao ar depois de o domínio servir HTTPS de forma estável.
