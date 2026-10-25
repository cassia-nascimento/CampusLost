# CampusLost — backend

API REST em **FastAPI + SQLite (SQLAlchemy 2)** que reproduz o comportamento dos serviços mockados do frontend (`frontend/src/services/contracts.ts`). O contrato completo (endpoints, JSON, erros) está em [`../docs/api/API.md`](../docs/api/API.md).

> Dados de demonstração são fictícios. Regras de negócio seguem `docs/prototype/SPEC.md`; a hospedagem em produção está em aberto (premissa P31).

## Requisitos

Python 3.13 (testado) e `pip`.

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

Contas de demonstração (senha **`demonstracao123`**): `marina@demo.test` (aluno), `rafael@demo.test` (professor), `externo@demo.test` (comunidade externa), `admin@demo.test` (administração), `lucas@demo.test`, `beatriz@demo.test` (todas com e-mail verificado). O seed copia as ilustrações para `uploads/seed/`.

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

- `0001_initial_schema` cria o esquema completo (usuários, sessões, tokens de e-mail, tentativas de login, itens, reivindicações, devoluções). Um teste (`tests/test_migrations.py`) compara a migração com os modelos e falha se divergirem.
- Com `ENV=production` a aplicação **não** chama `create_all`: rode `alembic upgrade head` no deploy, antes de subir.
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
| `MAIL_BACKEND` | `console` (dev) / `smtp` (produção) | `console` imprime o link no log; produção **exige** `smtp`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | — / `587` / — / — / — | SMTP com STARTTLS. `SMTP_HOST` e `SMTP_FROM` são obrigatórios com `MAIL_BACKEND=smtp`. A senha nunca é logada. |
| `APP_BASE_URL` | `http://localhost:3000` | Base dos links dos e-mails (`/verificar-email`, `/redefinir-senha`). |
| `TURNSTILE_SECRET` | vazio (desligado) | Cloudflare Turnstile em signup/login/forgot/resend. |
| `TERMS_VERSION` | `2026-10` | Versão dos termos gravada no aceite. |
| `MAX_BODY_BYTES` | `11534336` | Corpo máximo da requisição (foto até 10 MB). |
| `BCRYPT_ROUNDS` | `12` | Custo do bcrypt. |

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
    deps.py        sessão de banco, usuário atual
    errors.py      ServiceError + status por código
    photos.py      fotos em disco
    seed.py        seed de demonstração (CLI)
    create_admin.py
    rules/         regras puras: máquina de estados, permissões, validações, política de senha (porte de frontend/src/lib)
  alembic/         migrações (env.py, versions/)
    routers/       auth, items, claims, returns, catalog, demo
  tests/
```

## Segurança (resumo)

Senhas com bcrypt (nunca devolvidas; política: 10+ caracteres, <= 72 bytes, lista de comuns); JWT com `exp` obrigatório e tipo de token (o `profileToken` do Google não serve como sessão), preso a uma sessão revogável; cookies HttpOnly/SameSite=Lax com refresh rotativo e detecção de reuso; CSRF por `X-Requested-With` + `Origin` no modo cookie; tokens de e-mail só como hash SHA-256, uso único, expiram; e-mail de conta de senha precisa ser confirmado antes de cadastrar item/reivindicar; login Google descarta conta de senha **não verificada** do mesmo e-mail (anti pre-hijack); limite de login persistido com bloqueio progressivo; consultas via ORM (parametrizadas); fotos validadas pelo conteúdo (assinatura), nome gerado e limite de 10 MB; corpo limitado; erros internos não expõem detalhes; CORS restrito.

## Limitações conhecidas

- **Hospedagem serverless (ex.: Vercel) não persiste** o arquivo SQLite nem `uploads/`. Em produção é preciso um host com disco persistente (VM, container com volume) ou trocar banco/armazenamento de fotos. Decisão da equipe (SPEC P31).
- A trava de escrita e o limite por IP das rotas de e-mail/medidor de senha são **em memória, por processo**: rode com um único worker (`uvicorn` padrão). O limite de **login** é persistido no banco.
- Atrás de proxy reverso, rode `uvicorn --proxy-headers --forwarded-allow-ips=<ip do proxy>`; senão todo login parece vir do IP do proxy.
- O envio de e-mail roda em segundo plano na própria requisição (sem fila): se o SMTP falhar, só há log e a pessoa usa "reenviar". Residual: quem clica no link de verificação de uma conta que não criou valida a conta de outra pessoa (pre-hijack pelo link); o e-mail avisa para ignorar.
- Sessões expiradas/revogadas não são removidas automaticamente da tabela `sessions`.
- `POST /demo/reset` não exige login (como no mock): mantenha `DEMO_MODE=false` fora de demonstrações.
- O papel aluno/professor é autodeclarado (limitação do documento de decisões).
