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

Contas de demonstração (senha **`demo12345`**): `marina@demo.test` (aluno), `rafael@demo.test` (professor), `admin@demo.test` (administração), `lucas@demo.test`, `beatriz@demo.test`. O seed copia as ilustrações para `uploads/seed/`.

Com `ENV=production` o seed se recusa a rodar (cria contas de senha pública). Para criar uma administração real:

```bash
python -m app.create_admin --email admin@undb.edu.br --name "Nome Completo"   # pede a senha no terminal (ou ADMIN_PASSWORD)
```

## Testes

```bash
pytest            # 258 testes, banco SQLite temporário por teste, sem rede
```

A chamada ao `tokeninfo` do Google é simulada nos testes. Nenhum teste toca em `data/` nem em `uploads/`.

## Variáveis de ambiente

Veja `.env.example`. Nenhum valor real é versionado.

| Variável | Padrão | Descrição |
|---|---|---|
| `ENV` | `development` | `production` exige `SECRET_KEY` (≥ 32 caracteres) e desliga `/docs` e, por padrão, o modo demo. |
| `SECRET_KEY` | chave de dev **insegura** (aviso no log) | Assina os JWT (HS256). Gere: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Vida do token de sessão. |
| `DATABASE_URL` | `sqlite:///<backend>/data/campuslost.db` | Caminho do SQLite (pragmas `foreign_keys=ON`, WAL). Tabelas por `create_all`, sem Alembic. |
| `UPLOADS_DIR` | `<backend>/uploads` | Fotos enviadas; servidas em `/uploads/<arquivo>`. |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens permitidas, separadas por vírgula. |
| `DEMO_MODE` | `true` (dev) / `false` (`ENV=production`) | Liga `/demo/*` e o seed automático na subida. |
| `GOOGLE_CLIENT_ID` | vazio | Sem ele `POST /auth/google` responde 503. |
| `GOOGLE_ALLOWED_DOMAINS` | `undb.edu.br` | Domínio exato ou subdomínio (hipótese P30). |
| `APP_TIMEZONE` | `America/Fortaleza` | Fuso das datas de calendário ("hoje", filtros de período). |
| `LOGIN_RATE_LIMIT` / `LOGIN_RATE_WINDOW_SECONDS` | `10` / `60` | Tentativas de login por IP + e-mail. |
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
    security.py    bcrypt, JWT, limite de login
    google_auth.py verificação do ID token (tokeninfo)
    deps.py        sessão de banco, usuário atual
    errors.py      ServiceError + status por código
    photos.py      fotos em disco
    seed.py        seed de demonstração (CLI)
    create_admin.py
    rules/         regras puras: máquina de estados, permissões, validações (porte de frontend/src/lib)
    routers/       auth, items, claims, returns, catalog, demo
  tests/
```

## Segurança (resumo)

Senhas com bcrypt (nunca devolvidas); JWT com `exp` obrigatório e tipo de token (o `profileToken` do Google não serve como sessão); consultas via ORM (parametrizadas); fotos validadas pelo conteúdo (assinatura), nome gerado e limite de 10 MB; corpo limitado; erros internos não expõem detalhes; CORS restrito.

## Limitações conhecidas

- **Hospedagem serverless (ex.: Vercel) não persiste** o arquivo SQLite nem `uploads/`. Em produção é preciso um host com disco persistente (VM, container com volume) ou trocar banco/armazenamento de fotos. Decisão da equipe (SPEC P31).
- Limite de login e trava de escrita são **em memória, por processo**: rode com um único worker (`uvicorn` padrão).
- `POST /demo/reset` não exige login (como no mock): mantenha `DEMO_MODE=false` fora de demonstrações.
- O papel aluno/professor é autodeclarado (limitação do documento de decisões).
