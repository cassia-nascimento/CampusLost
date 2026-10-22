# CampusLost — API REST (FastAPI + SQLite)

Documento de referência para escrever o cliente REST do frontend (`services/api/*`, trocando o mock em `services/index.ts`). Tudo aqui foi conferido contra a implementação em `backend/` e contra `frontend/src/services/contracts.ts`; os testes em `backend/tests/` cobrem cada regra citada.

Rótulos usados: **[Contrato]** vem de `contracts.ts`/`types/domain.ts`; **[Premissa]** é escolha deste backend (ver `SPEC.md` §9, P31).

## 1. Convenções gerais

| Tema | Regra |
|---|---|
| Base | `http://127.0.0.1:8000` em desenvolvimento (`uvicorn app.main:app --port 8000`). Sem prefixo de versão. Variável sugerida no frontend: `NEXT_PUBLIC_API_URL`. |
| Formato | JSON (`Content-Type: application/json`), exceto criar/editar item (`multipart/form-data`). Chaves em camelCase, iguais às de `types/domain.ts`. |
| Autenticação | `Authorization: Bearer <token>`. O token vem de `signup`, `login`, `google`, `google/complete` ou `demo/login`. É um JWT HS256 de vida configurável (padrão 8 h). **Não há refresh nem logout no servidor**: sair = descartar o token. |
| Token inválido | Cabeçalho `Authorization` presente mas token expirado/adulterado/de usuário que não existe mais ⇒ **401 `UNAUTHENTICATED`** "Sua sessão expirou. Entre novamente.", **inclusive nos endpoints públicos** (`GET /items`, `GET /items/{id}`). O cliente deve descartar a sessão. Sem cabeçalho = visitante. |
| Datas de calendário | `YYYY-MM-DD` (`foundDate`, filtros `from`/`to`), no fuso do servidor (`APP_TIMEZONE`, padrão `America/Fortaleza`). "Hoje" (data não futura, datas relativas do seed) usa esse fuso. |
| Instantes | ISO 8601 em UTC com milissegundos e `Z`: `2026-10-22T15:00:00.000Z` (`createdAt`, `reviewedAt`, `returnedAt`, `expiresAt`). |
| Campos ausentes | `reviewedAt` é **omitido** enquanto a reivindicação não foi analisada (como `reviewedAt?: string`). `photoUrl` é sempre presente: string ou `null`. |
| IDs | Strings opacas. Seed: `user-marina`, `item-01`, `claim-01`, `return-01`… Novos: `item-<10 hex>` etc. |
| Corpo máximo | 11 MB (`MAX_BODY_BYTES`). Acima disso: 413. |
| CORS | Apenas as origens de `CORS_ORIGINS` (padrão `http://localhost:3000`). Métodos GET/POST/PUT/DELETE; cabeçalhos `Authorization`, `Content-Type`. Sem cookies. |
| Segurança | O hash de senha nunca sai da API. Todos os textos devolvidos estão em pt-BR. Respostas têm `X-Content-Type-Options: nosniff`. |

### 1.1 Formato de erro

Toda falha tem este corpo (mesmo para 404 de rota, 405, 413 e 500):

```json
{ "code": "VALIDATION", "message": "Confira os campos destacados.", "fieldErrors": { "title": "Use pelo menos 3 caracteres." } }
```

`code` é um `ServiceErrorCode` do frontend e `message` já é texto apresentável. `fieldErrors` só aparece em `VALIDATION` (uma mensagem por campo, a primeira que falhou) e em `EMAIL_TAKEN` (`{"email": "..."}`). O cliente cria `new ServiceError(code, message, { fieldErrors })` direto do corpo.

| `code` | HTTP | Quando |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Sem sessão ("Entre na sua conta para continuar."), token inválido/expirado ("Sua sessão expirou. Entre novamente."), credencial Google inválida. |
| `INVALID_CREDENTIALS` | 401 | Login: e-mail inexistente, senha errada ou conta só-Google. Mensagem única: "E-mail ou senha incorretos." |
| `FORBIDDEN` | 403 | Papel sem permissão. |
| `FORBIDDEN_DOMAIN` | 403 | Google fora do domínio institucional: "Use o e-mail institucional da UNDB." |
| `NOT_FOUND` | 404 | Item/reivindicação inexistente; **item devolvido para visitante**; rota inexistente; `/demo/*` desligado. |
| `VALIDATION` | 422 | Campos inválidos (`fieldErrors`). Também 413 (corpo grande demais) e 400 (multipart malformado) com `message` própria. |
| `PHOTO_INVALID` | 422 | Foto fora do formato/tamanho (sem `fieldErrors`). Também 413 em upload acima do limite do corpo. |
| `EMAIL_TAKEN` | 409 | E-mail já cadastrado. |
| `INVALID_TRANSITION` | 409 | Transição de estado não permitida (ex.: devolver sem reivindicação aceita; analisar reivindicação já analisada). |
| `DUPLICATE_CLAIM` | 409 | Usuário já tem reivindicação ativa/aceita no item. |
| `CLAIM_BLOCKED` | 409 | Reivindicação recusada antes (sem reenviar) ou item já com reivindicação aceita (P14). |
| `ITEM_RETURNED` | 409 | Item devolvido é somente leitura. |
| `RATE_LIMITED` | 429 | **Novo, não existe em `ServiceErrorCode`** — adicionar ao tipo. Login: mais de 10 tentativas/min por IP+e-mail. Traz `Retry-After` (segundos). |
| `UNEXPECTED` | 500 / 502 / 503 | Erro interno (sem detalhes), Google inacessível (502) ou não configurado (503). |
| `NETWORK`, `CONFLICT`, `STORAGE_FULL` | — | O servidor não os emite. `NETWORK` é do cliente (sem resposta/timeout). |

Ordem de verificação (igual à do mock): sessão → existência do recurso → permissão/estado → validação de campos → foto. Exceção: **criar reivindicação valida o corpo antes de checar sessão/papel**, como o mock.

### 1.2 Regra de `photoUrl`

- `photoUrl` substitui `photoDataUrl`. É `null` (sem foto) ou um **caminho relativo ao servidor da API**: `/uploads/<uuid32>.jpg|png|webp` (foto enviada) ou `/uploads/seed/<slug>.svg` (ilustração do seed, P27).
- O cliente monta a URL final com `API_BASE + photoUrl` (ex.: `http://127.0.0.1:8000/uploads/seed/oculos.svg`). Se usar `next/image`, liberar o host da API em `images.remotePatterns` (e `dangerouslyAllowSVG` para os SVG do seed, ou usar `<img>`/`unoptimized`).
- Os arquivos são públicos (`GET /uploads/<arquivo>`, sem autenticação), com nome aleatório não adivinhável.
- A API **não redimensiona** (o mock reduzia para 640 px no navegador). O cliente pode continuar reduzindo antes de enviar; o limite do servidor é 10 MB.

## 2. Mapeamento `contracts.ts` ⇄ API

| Método do contrato | Chamada REST | Observação |
|---|---|---|
| `auth.getCurrentUser()` | `GET /auth/me` | **401 ⇒ devolver `null`** (a API não devolve `null`). Resposta: `User` puro. |
| `auth.signUp(input)` | `POST /auth/signup` | Resposta `Session`; guardar `token`, devolver `user`. |
| `auth.signIn(input)` | `POST /auth/login` | Idem. |
| `auth.signInWithGoogle(profile)` | `POST /auth/google` | **Muda a entrada**: envia `{credential}` (ID token bruto); a verificação é no servidor. `needs_role` traz também `profileToken`; guardar para o passo seguinte. |
| `auth.completeGoogleSignUp(input)` | `POST /auth/google/complete` | Envia `{profileToken, role}` (não mais e-mail/nome: vêm do token). |
| `auth.signInAsDemo(role)` | `POST /demo/login/{role}` | Só com `DEMO_MODE=true`. |
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
| `returns.register(itemId)` | `POST /items/{id}/return` | `ReturnView` (201). |
| `returns.list(period)` | `GET /returns?from=&to=` | `ReturnView[]`, mais recentes primeiro. |
| `demo.reset()` | `POST /demo/reset` | 204. Sem autenticação (como no mock). |
| `demo.persistence()` | — | Constante `"durable"` no cliente. |
| `subscribe(listener)` | — | **A API não notifica.** Reler após cada mutação própria e (para AC04.8) refazer a leitura por intervalo/foco da janela. |

Itens sem equivalente: o catálogo (`DEMO_CATEGORIES`/`DEMO_LOCATIONS`) também está em `GET /catalog`; o frontend pode seguir usando `types/catalog.ts`.

## 3. Tipos JSON

### `User` (`types/domain.ts: User`)
```json
{ "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "student" }
```
`role`: `"student" | "teacher" | "admin"`.

### `PublicUser`
```json
{ "id": "user-lucas", "name": "Lucas Prado", "role": "student" }
```

### `Session` (resposta de login, cadastro, Google e demo)
```json
{
  "token": "eyJhbGciOi...",
  "tokenType": "bearer",
  "expiresAt": "2026-10-22T23:00:00.000Z",
  "user": { "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "student" }
}
```

### `Item` (completo; usuário logado) = `types/domain.ts: Item`
```json
{
  "id": "item-03",
  "title": "Chaveiro com três chaves",
  "description": "Chaveiro de borracha vermelho com três chaves, sendo uma delas de cadeado.",
  "category": "Chaves",
  "foundLocation": "Bloco A",
  "foundDate": "2026-10-20",
  "storedAt": "Portaria",
  "photoUrl": "/uploads/seed/chaveiro.svg",
  "status": "under_claim",
  "createdById": "user-lucas",
  "createdAt": "2026-10-20T13:00:00.000Z"
}
```
`status`: `"available" | "under_claim" | "returned"`. Diferença para o tipo do frontend: `photoDataUrl?: string` ⇒ **`photoUrl: string | null`**.

### `ItemView` / `PublicItemView` (listas e detalhe)
- **Logado** (qualquer papel): igual a `Item` (traz `storedAt` e `createdById`).
- **Visitante** (sem `Authorization`): `PublicItemView` — **as chaves `storedAt` e `createdById` não existem no JSON**:
```json
{ "id": "item-03", "title": "...", "description": "...", "category": "Chaves", "foundLocation": "Bloco A",
  "foundDate": "2026-10-20", "photoUrl": "/uploads/seed/chaveiro.svg", "status": "under_claim", "createdAt": "2026-10-20T13:00:00.000Z" }
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

### `ClaimView` = `Claim` + `"claimant": User` + `"item": Item` (completo, com `storedAt`).
```json
{
  "id": "claim-06", "itemId": "item-07", "claimantId": "user-marina",
  "proofDetails": "...", "lostWhereWhen": "...", "status": "pending", "createdAt": "2026-10-21T09:00:00.000Z",
  "claimant": { "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "student" },
  "item": { "id": "item-07", "title": "Calculadora científica", "...": "...", "storedAt": "Portaria", "photoUrl": "/uploads/seed/calculadora.svg", "status": "under_claim", "createdById": "user-lucas", "createdAt": "2026-10-19T13:00:00.000Z" }
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
{ "status": "needs_role", "profile": { "email": "ana@undb.edu.br", "name": "Ana Souza" }, "profileToken": "eyJ..." }
```
(`GoogleSignInResult` do contrato ganha `token`/`expiresAt` no ramo `signed_in` e `profileToken` no `needs_role`.)

## 4. Endpoints

Legenda de autenticação: **público** = sem token; **logado** = qualquer papel; **aluno/prof.** = `student` ou `teacher`; **admin** = `admin`.

### 4.1 Infraestrutura

#### `GET /health` — público
`200 {"status":"ok"}`

#### `GET /catalog` — público
Categorias e locais **demonstrativos** (P5).
```json
{ "categories": ["Eletrônicos","Documentos","Roupas","Chaves","Outros"], "locations": ["Bloco A","Biblioteca","Cantina","Portaria"],
  "notice": "Categorias e locais de demonstração; os valores finais serão definidos pela equipe." }
```

#### `GET /uploads/{arquivo}` — público
Serve fotos (`/uploads/<uuid>.jpg`) e ilustrações do seed (`/uploads/seed/<slug>.svg`). 404 se não existir.

### 4.2 Autenticação

#### `POST /auth/signup` — público
Corpo: `{ "name": "Joana Silva", "email": "joana@exemplo.com", "password": "senha-forte-1", "role": "student" }`
- `name` 2–80 (após trim); `email` válido, até 120, normalizado (trim + minúsculas); `password` 8–72 caracteres **e no máximo 72 bytes UTF-8** (bcrypt), sem trim; `role` apenas `student` ou `teacher` (administração só por seed/script).
- **201** `Session`.
- Erros: 422 `VALIDATION` (mensagens: "Informe seu nome.", "Use pelo menos 2 caracteres.", "Use no máximo 80 caracteres.", "Informe seu e-mail.", "Esse e-mail não parece válido. Use o formato nome@exemplo.com.", "Crie uma senha.", "Use pelo menos 8 caracteres.", "Use no máximo 72 caracteres.", "Escolha se você é aluno ou professor."); 409 `EMAIL_TAKEN` (`fieldErrors.email` = "Este e-mail já está cadastrado.", comparação sem diferenciar maiúsculas).

#### `POST /auth/login` — público
Corpo: `{ "email": "marina@demo.test", "password": "demo12345" }`
- **200** `Session`.
- 401 `INVALID_CREDENTIALS` "E-mail ou senha incorretos." (e-mail inexistente, senha errada e conta só-Google são indistinguíveis).
- 422 `VALIDATION` para formato inválido (e-mail mal formado: "Esse e-mail não parece válido…"; senha vazia: "Informe sua senha.").
- 429 `RATE_LIMITED`: mais de 10 tentativas por minuto para o mesmo IP + e-mail (`LOGIN_RATE_LIMIT`), com `Retry-After`.

#### `GET /auth/me` — logado
**200** `User`. Sem token ou token inválido: 401.

#### `POST /auth/google` — público (P30)
Corpo: `{ "credential": "<ID token do Google Identity Services>" }`
O servidor chama `https://oauth2.googleapis.com/tokeninfo` e confere `aud == GOOGLE_CLIENT_ID`, `iss` (`accounts.google.com` ou `https://accounts.google.com`), `exp` futuro e `email_verified`. O domínio do e-mail deve ser exatamente um de `GOOGLE_ALLOWED_DOMAINS` (padrão `undb.edu.br`) ou **subdomínio** dele; `evilundb.edu.br` e `undb.edu.br.evil.com` são recusados.
- **200** `GoogleSignInResult`: conta existente ⇒ `signed_in` (com `token`); inexistente ⇒ `needs_role` (nada foi criado; `profileToken` é um JWT de 10 min que prova o perfil verificado).
- 401 `UNAUTHENTICATED` "Não foi possível verificar sua conta Google. Tente novamente." (token recusado, `aud`/`iss`/`exp`/`email_verified` inválidos); 403 `FORBIDDEN_DOMAIN`; 422 `VALIDATION` (`fieldErrors.credential`); 502 `UNEXPECTED` (Google inacessível); 503 `UNEXPECTED` "O login com Google não está configurado." (sem `GOOGLE_CLIENT_ID`).

#### `POST /auth/google/complete` — público (exige `profileToken` válido)
Corpo: `{ "profileToken": "eyJ...", "role": "teacher" }` (`role`: `student`|`teacher`).
Cria a conta **sem senha** com e-mail/nome do token e abre sessão. Sem `profileToken` válido (ausente, adulterado, expirado ou um token de sessão) não cria nada.
- **201** `Session`.
- 401 `UNAUTHENTICATED` "Sua verificação do Google expirou. Entre com o Google novamente."; 403 `FORBIDDEN_DOMAIN`; 409 `EMAIL_TAKEN`; 422 `VALIDATION` (`fieldErrors.role`).

### 4.3 Itens

#### `GET /items` — público (P26)
Query (todos opcionais; valor vazio é ignorado): `category` (uma de `/catalog`), `location`, `from` e `to` (`YYYY-MM-DD`, inclusivos, sobre `foundDate` — P11), `status` (`available`|`under_claim`; `returned` é inválido), `sort` (`registered` padrão = mais recentemente registrado primeiro; `found` = mais recentemente encontrado primeiro). Filtros combinam (E). **Itens devolvidos nunca aparecem.** Desempate: o outro critério e depois o `id`.
- **200** `ItemView[]` (visitante: sem `storedAt`/`createdById`).
- 422 `VALIDATION`: "Categoria inválida.", "Local inválido.", "Situação inválida.", "Ordenação inválida.", "Informe uma data válida." (`from`/`to`), "A data final deve ser igual ou posterior à inicial." (em `to`).

#### `GET /items/{id}` — público (P26)
**200** `ItemDetail`. 404 `NOT_FOUND` (inexistente; ou devolvido para visitante).

#### `POST /items` — aluno/prof./admin
`multipart/form-data` com os campos de texto abaixo e `photo` opcional (arquivo).

| Campo | Regra |
|---|---|
| `title` | 3–80 (trim) |
| `description` | 10–500 |
| `category` | uma de `/catalog` ("Escolha uma categoria.") |
| `foundLocation` | uma de `/catalog` ("Escolha o local onde foi encontrado.") |
| `foundDate` | `YYYY-MM-DD` válida, não futura ("Informe a data.", "Informe uma data válida.", "A data não pode ser no futuro.") |
| `storedAt` | 3–120 ("Informe onde o item está guardado.") |
| `photo` | opcional. JPEG, PNG ou WebP **identificado pelo conteúdo** (assinatura do arquivo; extensão e `Content-Type` declarados são ignorados), até 10 MB. Parte de arquivo vazia e sem nome (navegador sem arquivo escolhido) = sem foto |

Campos extras (`status`, `createdById`, `photoUrl`…) são ignorados: o item nasce `available`, com `createdById` = usuário do token.
- **201** `Item` (completo).
- 401/403; 422 `VALIDATION` (campos) **antes** de `PHOTO_INVALID`: "Formato não aceito. Use JPG, PNG ou WebP.", "O arquivo está vazio.", "A foto passa de 10 MB. Escolha uma menor."; 413 se o corpo passar de 11 MB.

Exemplo (curl):
```bash
curl -X POST http://127.0.0.1:8000/items -H "Authorization: Bearer $TOKEN" \
  -F title="Agenda vermelha" -F description="Agenda vermelha com elástico e capa dura." \
  -F category=Outros -F foundLocation=Biblioteca -F foundDate=2026-10-21 -F storedAt=Portaria \
  -F "photo=@agenda.png;type=image/png"
```

#### `PUT /items/{id}` — admin
Mesmos campos de `POST /items`, mais `removePhoto` (`true`/`1`/`on`). Foto: arquivo novo substitui (e apaga o arquivo antigo); sem arquivo mantém; `removePhoto=true` sem arquivo remove (arquivo novo vence `removePhoto`). O status do item não muda.
- **200** `Item`. Ordem de erros: 401 → 404 → 403 `FORBIDDEN` "Somente a administração pode editar itens." → 409 `ITEM_RETURNED` "Itens devolvidos não podem ser editados." → 422.

#### `DELETE /items/{id}` — admin
**204**. Remove também as reivindicações do item (P18) e o arquivo da foto enviada (nunca as ilustrações do seed). Erros: 404; 403 "Somente a administração pode excluir itens."; 409 `ITEM_RETURNED` "Itens devolvidos não podem ser excluídos.".

### 4.4 Reivindicações

#### `POST /items/{id}/claims` — aluno/prof.
Corpo: `{ "proofDetails": "Tem um adesivo azul na parte de trás.", "lostWhereWhen": "Biblioteca, ontem de manhã." }` — `proofDetails` 10–500, `lostWhereWhen` 5–300 (trim). Item `available` passa a `under_claim`.
- **201** `Claim` (`status: "pending"`).
- 422 `VALIDATION` (primeiro, antes da checagem de sessão); 401; 403 (admin: "Você não tem permissão para realizar esta ação."); 404 item; e as decisões de `viewer.claim`: 409 `ITEM_RETURNED` "Este item já foi devolvido."; 409 `DUPLICATE_CLAIM` ("Sua reivindicação foi aceita. Procure a administração para retirar o item." / "Você já tem uma reivindicação em andamento para este item."); 409 `CLAIM_BLOCKED` ("Sua reivindicação para este item foi recusada. Procure a administração." / "Este item já tem uma reivindicação aceita e aguarda a devolução." — P14).

#### `GET /items/{id}/claims` — admin
**200** `ClaimView[]`, mais antigas primeiro. 404 se o item não existir.

#### `GET /claims/mine` — aluno/prof.
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

#### `POST /items/{id}/return` — admin
Sem corpo. Exige reivindicação aceita; o destinatário é o autor dela (P19); item → `returned` (irreversível).
- **201** `ReturnView`.
- 404; 403 "Somente a administração pode registrar devoluções."; 409 `ITEM_RETURNED` "Este item já foi devolvido."; 409 `INVALID_TRANSITION` "Só é possível devolver um item que está em reivindicação." / "Aceite uma reivindicação antes de registrar a devolução.".

#### `GET /returns` — admin
Query: `from`, `to` (`YYYY-MM-DD`, inclusivos, sobre a **data local** de `returnedAt`). **200** `ReturnView[]`, mais recentes primeiro. 422 como em `GET /items` (datas/período).

### 4.6 Demonstração (só com `DEMO_MODE=true`; senão 404 `NOT_FOUND`)

#### `GET /demo/profiles` — público
```json
[ { "role": "student", "label": "Entrar como aluno", "user": { "id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "student" } },
  { "role": "teacher", "label": "Entrar como professor", "user": { "id": "user-rafael", "...": "..." } },
  { "role": "admin", "label": "Entrar como administração", "user": { "id": "user-admin", "...": "..." } } ]
```

#### `POST /demo/login/{role}` — público
`role`: `student`|`teacher`|`admin`. **200** `Session`. 404 para outro valor.

#### `POST /demo/reset` — público
Restaura o seed (datas relativas a hoje) e apaga as fotos enviadas. **204**. Tokens dos 5 usuários do seed continuam válidos; os de usuários criados depois passam a dar 401.

## 5. Dados de demonstração (seed)

Contas `*@demo.test`, senha **`demo12345`** (pública): `marina@` (aluno, `user-marina`), `rafael@` (professor, `user-rafael`), `admin@` (administração, `user-admin`), `lucas@`, `beatriz@` (alunos de apoio). 11 itens (`item-01`…`item-11`; `item-10` e `item-11` devolvidos), 9 reivindicações, 2 devoluções, mesmos ids, textos e datas relativas ao mock (`frontend/src/services/mock/seed.ts`). Fotos: `/uploads/seed/<slug>.svg`.

## 6. Diferenças em relação ao mock (para o cliente tratar)

1. **Sessão**: o mock guarda `userId` em `sessionStorage`; a API devolve `token` (guardar em `sessionStorage`, manter P21). Qualquer 401 `UNAUTHENTICATED` com token enviado ⇒ descartar sessão.
2. **`getCurrentUser`**: a API responde 401 sem sessão; o cliente converte em `null`.
3. **Google**: `signInWithGoogle` recebe `credential` (não o perfil) e `completeGoogleSignUp` recebe `profileToken` + `role`. A rota `/api/auth/google` do Next deixa de ser necessária.
4. **`subscribe`**: não existe push. Releitura manual/periódica.
5. **Foto**: `photoUrl` (caminho relativo à API) no lugar de `photoDataUrl`; upload em `multipart`; sem redimensionamento no servidor.
6. **`RATE_LIMITED`** (429) é código novo.
7. **Latência/falha simulada** do mock não existem; erros de rede são `NETWORK` no cliente.
8. **Concorrência**: o servidor serializa as escritas (um processo); duas reivindicações simultâneas do mesmo usuário no mesmo item resultam em uma 201 e uma 409 `DUPLICATE_CLAIM`.
9. **`createdBy`** continua no `ItemDetail` do visitante como `null` (contrato), sem nenhum dado do autor.
