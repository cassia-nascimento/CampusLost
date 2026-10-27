# CampusLost — backend

API REST em **FastAPI + SQLite (SQLAlchemy 2)** que reproduz o comportamento dos serviços mockados do frontend (`frontend/src/services/contracts.ts`). O contrato completo (endpoints, JSON, erros) está em [`../docs/api/API.md`](../docs/api/API.md).

> Dados de demonstração são fictícios. Regras de negócio seguem `docs/prototype/SPEC.md`; a hospedagem em produção está em aberto (premissa P31).

## Requisitos

Python 3.13 (testado localmente) e `pip`. O CI usa Python 3.12.

## Instalação

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # opcional; sem .env valem os padrões de desenvolvimento
```

Em desenvolvimento e nos testes as tabelas são criadas sozinhas (`create_all`). Em **produção** o esquema vem só do Alembic (veja "Migrações").

## Rodar

```bash
uvicorn app.main:app --reload --port 8000
```

- API em <http://127.0.0.1:8000>; documentação interativa em `/docs` (desligada com `ENV=production`).
- Em desenvolvimento (`DEMO_MODE=true`) o banco vazio recebe o seed sozinho na subida. Para (re)aplicar manualmente:

```bash
python -m app.seed             # APAGA os dados e recria o seed
python -m app.seed --if-empty  # só se não houver usuários
```

Contas de demonstração (senha **`demonstracao123`**): `marina@demo.test`, `rafael@demo.test`, `lucas@demo.test`, `beatriz@demo.test` (papel `user`, vínculo `institutional`), `externo@demo.test` (`user`, vínculo `external`), `admin@demo.test` (`admin`, `institutional`); todas com e-mail verificado. Atalhos de demonstração (`GET /demo/profiles`, `POST /demo/login/{key}`): só `user` (Marina) e `admin`; `externo@demo.test` e as demais contas entram por e-mail e senha (`/demo/login/institutional|external|student|teacher` dão 404). O seed copia as ilustrações para `uploads/seed/`.

Com `ENV=production` o seed se recusa a rodar (cria contas de senha pública). Para criar uma administração real:

```bash
python -m app.create_admin --email admin@undb.edu.br --name "Nome Completo"   # pede a senha no terminal (ou ADMIN_PASSWORD); política de senha vale
```

## Migrações (Alembic)

```bash
cd backend
alembic upgrade head                 # aplica as migrações em DATABASE_URL (padrão: data/campuslost.db)
alembic current                      # revisão aplicada
alembic revision --autogenerate -m "descricao"   # após mudar app/models.py; REVISE o arquivo gerado
alembic upgrade head --sql           # só imprime o SQL (modo offline)
```

- `0003_role_user_admin_affiliation` converte `users.role` (`student|teacher|external` → `user`) e cria `users.affiliation` (student/teacher → `institutional`, external → `external`, admin → pelo domínio do e-mail com `GOOGLE_ALLOWED_DOMAINS`). O downgrade devolve `student` (institutional) ou `external`; a diferença aluno/professor não é recuperável.
- `0001_initial_schema` cria o esquema completo (usuários, sessões, tokens de e-mail, tentativas de login, itens, reivindicações, devoluções). `0002_audit_2fa_invites` acrescenta `audit_log`, `recovery_codes`, `admin_invites` e as colunas `users.disabled_at`, `totp_secret`, `totp_enabled_at`, `totp_last_step` (bancos em 0001 sobem sem perder dados; há teste). Um teste (`tests/test_migrations.py`) compara a migração com os modelos e falha se divergirem.
- Com `ENV=production` a aplicação **não** chama `create_all`: rode `alembic upgrade head` no deploy, antes de subir.
- Na subida (`create_app`, inclusive em produção) `app/schema_check.py` compara colunas dos modelos com as do banco e, se faltar algo, aborta com a lista `tabela.coluna` e as instruções (apagar `data/campuslost.db` em demonstração, ou `alembic upgrade head`); nunca altera o banco sozinho.
- Bancos de desenvolvimento criados antes desta versão (por `create_all`) não têm as colunas/tabelas novas: apague `data/campuslost.db` (o seed recria) ou use `alembic stamp` só se o esquema já for idêntico. Não há migração de dados antigos.
- SQLite não altera tabelas no lugar: o `env.py` usa `render_as_batch`, então as próximas migrações usam `batch_alter_table`.

## Testes

```bash
pytest            # banco SQLite temporário por teste, sem rede, sem e-mail real
```

A chamada ao `tokeninfo` do Google, o SMTP e o Cloudflare Turnstile são **simulados** nos testes: o envio real de e-mail, o login Google real e o captcha real **não foram testados**. Nenhum teste toca em `data/` nem em `uploads/`.

## Variáveis de ambiente

Veja `.env.example`. Nenhum valor real é versionado.

| Variável | Padrão | Descrição |
|---|---|---|
| `ENV` | `development` | `production` exige `SECRET_KEY` (≥ 32 caracteres) e desliga `/docs` e, por padrão, o modo demo. |
| `SECRET_KEY` | chave de dev **insegura** (aviso no log) | Assina os JWT (HS256). Gere: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Vida do token Bearer. |
| `COOKIE_ACCESS_MINUTES` / `REFRESH_DAYS` | `15` / `7` | Vida do cookie de acesso e do refresh rotativo. |
| `COOKIE_SECURE` | vazio (liga fora de development/test) | Atributo `Secure` dos cookies. |
| `DATABASE_URL` | `sqlite:///<backend>/data/campuslost.db` | Caminho do SQLite (pragmas `foreign_keys=ON`, WAL). Esquema: `create_all` em dev/testes, Alembic em produção. |
| `UPLOADS_DIR` | `<backend>/uploads` | Fotos enviadas; servidas em `/uploads/<arquivo>`. |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens permitidas, separadas por vírgula. |
| `DEMO_MODE` | `true` (dev) / `false` (`ENV=production`) | Liga `/demo/*` e o seed automático na subida. |
| `GOOGLE_CLIENT_ID` | vazio | Sem ele `POST /auth/google` responde 503. |
| `GOOGLE_ALLOWED_DOMAINS` | `undb.edu.br` | Domínio exato ou subdomínio (hipótese P30). |
| `APP_TIMEZONE` | `America/Fortaleza` | Fuso das datas de calendário ("hoje", filtros de período). |
| `LOGIN_RATE_LIMIT` / `LOGIN_RATE_WINDOW_SECONDS` | `10` / `60` | Falhas de login por IP + e-mail até bloquear / duração do 1º bloqueio (dobra a cada novo, até 1 h). Persistido no banco. |
| `RETURN_CODE_MAX_ATTEMPTS` / `RETURN_CODE_LOCK_SECONDS` / `RETURN_CODE_VERIFY_TTL_SECONDS` | `5` / `900` / `900` | Código de retirada da devolução: falhas até bloquear / duração do bloqueio / validade da conferência antes de confirmar a entrega. |
| `MAIL_BACKEND` | `console` (dev) / `smtp` (produção) | `console` imprime o link no log; produção **exige** `smtp`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | — / `587` / — / — / — | SMTP com STARTTLS. `SMTP_HOST` e `SMTP_FROM` são obrigatórios com `MAIL_BACKEND=smtp`. A senha nunca é logada. |
| `APP_BASE_URL` | `http://localhost:3000` | Base dos links dos e-mails (`/verificar-email`, `/redefinir-senha`). |
| `TURNSTILE_SECRET` | vazio (desligado) | Cloudflare Turnstile em signup/login/forgot/resend. |
| `TERMS_VERSION` | `2026-10` | Versão dos termos gravada no aceite. |
| `MAX_BODY_BYTES` | `11534336` | Corpo máximo da requisição (foto até 10 MB). |
| `BCRYPT_ROUNDS` | `12` | Custo do bcrypt. |
| `ADMIN_REQUIRE_2FA` | vazio | Exige 2FA da administração em `/admin/*`. Vazio = exigido, **exceto com `DEMO_MODE=true`**; `true`/`false` força. Em modo demo a conta `user-admin` do seed fica sempre isenta. |
| `COOKIE_REFRESH_PATH` | `/` | `Path` do cookie de refresh. **Atrás de proxy same-origin do Next (`/backend/...`) use `/`**, senão o navegador não envia o cookie. Recomendado com proxy: `COOKIE_REFRESH_PATH=/`, `COOKIE_SECURE=true`, `CORS_ORIGINS=<origem do site>`. Detalhes: `docs/api/API.md` §4.2.3. |
| `INVITE_TOKEN_HOURS` | `48` | Validade do convite de administração. |
| `BACKUP_DIR` | `<backend>/data/backups` | Destino de `python -m app.backup`. |

## Estrutura

```
backend/
  app/
    main.py        create_app(): middlewares, handlers de erro, rotas, /uploads
    config.py      variáveis de ambiente (Settings)
    db.py          engine SQLite + pragmas
    models.py      tabelas
    schemas.py     serialização JSON (contrato do frontend)
    security.py    bcrypt, JWT, hash de tokens opacos
    google_auth.py verificação do ID token (tokeninfo)
    session_service.py sessões, cookies, refresh rotativo
    login_throttle.py limite de login persistido
    email_tokens.py tokens de verificação/redefinição (hash, uso único)
    mailer.py      e-mail: console | smtp
    turnstile.py   captcha opcional
    routers/me.py  LGPD: exportar e excluir conta
    audit.py       trilha de auditoria (`audit_log`), sem dados sensíveis
    totp.py        TOTP RFC 6238 (stdlib) e códigos de recuperação
    twofa_service.py / login_flow.py  segundo fator e conclusão de login
    maintenance.py limpeza de expirados (CLI)
    backup.py      backup do SQLite (CLI)
    deps.py        sessão de banco, usuário atual
    errors.py      ServiceError + status por código
    photos.py      fotos em disco
    seed.py        seed de demonstração (CLI)
    create_admin.py
    rules/         regras puras: máquina de estados, permissões, validações, política de senha (porte de frontend/src/lib)
  alembic/         migrações (env.py, versions/)
    routers/       auth, twofa, admin, items, claims, returns, catalog, demo
  tests/
```

## Administração, auditoria e 2FA (B2)

- **Auditoria**: tabela `audit_log` (quem, o quê, alvo, IP, `metadata` sem dados sensíveis). Lista em `GET /admin/audit?action=&actor=&page=`. Eventos e campos: `docs/api/API.md` §4.8.
- **Usuários**: `GET /admin/users`, `PATCH /admin/users/{id}` (papel e ativar/desativar). Desativar revoga sessões e tokens na hora; login responde `ACCOUNT_DISABLED`. Ninguém altera a si mesmo, e o último admin ativo não é rebaixado nem desativado.
- **Convites de administração**: `POST/GET/DELETE /admin/invites` e `POST /auth/accept-invite`. Link de uso único, 48 h, só o hash no banco, enviado pelo mailer. Em desenvolvimento (`MAIL_BACKEND=console`) o link aparece no log. O script `python -m app.create_admin` continua sendo a forma de criar o **primeiro** admin.
- **2FA TOTP** (`/auth/2fa/*`): RFC 6238 em stdlib, 8 códigos de recuperação (só hash). Admin sem 2FA entra, mas recebe 403 `TWO_FACTOR_REQUIRED` em `/admin/*` até ativar. **Isenção**: `ADMIN_REQUIRE_2FA` vazio + `DEMO_MODE=true` (padrão de desenvolvimento) não exige, e o admin do seed demo (`user-admin`) é sempre isento em modo demo. Em produção (`DEMO_MODE=false`) é exigido. A exigência cobre `/admin/*` e também as rotas só-admin antigas (analisar reivindicações, editar/excluir item, registrar devolução, listar devoluções).
- **Cabeçalhos**: middleware envia `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` em `/auth`, `/me`, `/admin` e HSTS fora de development/test. CSP e cabeçalhos do Next: `docs/api/API.md` §7 (snippet para o frontend; não testado).

### Rotinas operacionais

```bash
python -m app.maintenance                  # apaga sessões/tokens/tentativas/convites expirados; imprime contagens
python -m app.maintenance --audit-days 365 # também apaga auditoria com mais de 365 dias (padrão: mantém tudo)
python -m app.backup                       # data/backups/campuslost-AAAAMMDD-HHMMSS.db (API de backup do sqlite3), mantém 7
python -m app.backup --keep 14 --dest /var/backups/campuslost
```

Agende ambos (cron/systemd timer), por exemplo limpeza diária e backup diário. O backup tem **todos** os dados (hashes de senha, segredos TOTP, auditoria): proteja o diretório. Fotos (`uploads/`) não entram no backup. Restaurar: pare a API e copie o arquivo sobre o banco. Não foi testada a restauração em outro host.

## Segurança (resumo)

Senhas com bcrypt (nunca devolvidas; política: 10+ caracteres, <= 72 bytes, lista de comuns); JWT com `exp` obrigatório e tipo de token (o `profileToken` do Google não serve como sessão), preso a uma sessão revogável; cookies HttpOnly/SameSite=Lax com refresh rotativo e detecção de reuso; CSRF por `X-Requested-With` + `Origin` no modo cookie; tokens de e-mail só como hash SHA-256, uso único, expiram; o cadastro por senha **não** exige confirmação de e-mail (sem e-mail de verificação no signup; a conta já cadastra item e reivindica, e `email_verified_at` fica nulo; limitação aceita: quem cadastra o e-mail de outra pessoa não é impedido de criar conta com ele); login Google descarta conta de senha **não verificada** do mesmo e-mail (anti pre-hijack); limite de login persistido com bloqueio progressivo; consultas via ORM (parametrizadas); fotos validadas pelo conteúdo (assinatura), nome gerado e limite de 10 MB; corpo limitado; erros internos não expõem detalhes; CORS restrito.

## Publicar a API (host com disco persistente)

Requer um host que mantenha disco entre reinícios (VM, container com volume). Variáveis (valores de exemplo):

```
ENV=production                       DEMO_MODE=false
SECRET_KEY=<python -c "import secrets; print(secrets.token_urlsafe(48))">
DATABASE_URL=sqlite:////dados/campuslost.db    UPLOADS_DIR=/dados/uploads     # /dados = volume persistente
CORS_ORIGINS=https://SEU-SITE.vercel.app       APP_BASE_URL=https://SEU-SITE.vercel.app   # origem exata, sem "/" final
COOKIE_REFRESH_PATH=/
MAIL_BACKEND=smtp  SMTP_HOST=...  SMTP_PORT=587  SMTP_USER=...  SMTP_PASSWORD=...  SMTP_FROM="CampusLost <remetente-verificado@...>"
```

```bash
pip install -r requirements.txt
alembic upgrade head                 # em produção o esquema só vem do Alembic (não apaga dados)
python -m app.create_admin --email <e-mail> --name "<nome>"    # 1º administrador (senha pedida no terminal ou ADMIN_PASSWORD)
uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'   # um único worker
```

Na Vercel (Settings > Environment Variables, depois **novo deploy**): `NEXT_PUBLIC_API_URL` e `API_INTERNAL_URL`, ambas com a URL pública da API (`https://...`, sem "/" final). O navegador só fala com `/backend/*` do próprio site; o Next repassa à API. Cada domínio de preview da Vercel que for usado precisa estar em `CORS_ORIGINS`.

E-mail: o log da API mostra `E-mail aceito pelo servidor para ...` (o SMTP aceitou; a entrega na caixa de entrada não é confirmada) ou `Falha ao enviar ... (SMTP 535)`. O remetente precisa estar verificado no provedor; alguns planos gratuitos de hospedagem bloqueiam as portas SMTP de saída (tente `SMTP_PORT=2525`, que também usa STARTTLS, se o provedor oferecer). Sem `SMTP_HOST`/`SMTP_FROM` a API **não sobe** em produção.

## Limitações conhecidas

- **Hospedagem serverless (ex.: Vercel) não persiste** o arquivo SQLite nem `uploads/`. Em produção é preciso um host com disco persistente (VM, container com volume) ou trocar banco/armazenamento de fotos. Decisão da equipe (SPEC P31).
- A trava de escrita e o limite por IP das rotas de e-mail/medidor de senha são **em memória, por processo**: rode com um único worker (`uvicorn` padrão). O limite de **login** é persistido no banco.
- Atrás de proxy reverso, rode `uvicorn --proxy-headers --forwarded-allow-ips=<ip do proxy>`; senão todo login parece vir do IP do proxy.
- O envio de e-mail roda em segundo plano na própria requisição (sem fila): se o SMTP falhar, só há log e a pessoa usa "reenviar" (verificação e recuperação de senha; o cadastro não envia e-mail). Residual: quem clica no link de verificação de uma conta que não criou valida a conta de outra pessoa (pre-hijack pelo link); o e-mail avisa para ignorar.
- Sessões expiradas/revogadas, tokens e tentativas de login vencidas só saem do banco quando `python -m app.maintenance` roda (agende-o).
- O segredo TOTP fica **em claro** em `users.totp_secret` (sem biblioteca de cifra no projeto): quem lê o banco ou um backup gera códigos. Proteja `data/` e os backups. Não há reset de 2FA por outra pessoa nesta versão.
- Convites e 2FA dependem do envio de e-mail/relógio corretos: o envio real (SMTP), o Google e o captcha **não foram testados**.
- `POST /demo/reset` não exige login (como no mock): mantenha `DEMO_MODE=false` fora de demonstrações.
- **Papel x vínculo**: `role` (`user`|`admin`) é o único que decide permissões, sempre no servidor. `affiliation` (`institutional`|`external`) vem só do DOMÍNIO do e-mail (`GOOGLE_ALLOWED_DOMAINS`, domínio ou subdomínio) na criação da conta e **não prova** vínculo real com a instituição; não muda se o domínio configurado mudar depois. Não há mais distinção aluno/professor.
