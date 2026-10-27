# CampusLost

Sistema de achados e perdidos universitário. Centraliza o registro, a busca, a reivindicação e a devolução de objetos encontrados no campus, para a comunidade do campus (usuários com conta) e a equipe administrativa.

Mini-Projeto da disciplina de Engenharia de Software — UNDB.

## Funcionalidades previstas

| ID   | Funcionalidade                             |
|------|--------------------------------------------|
| RF01 | Cadastro e autenticação de usuários        |
| RF02 | Registro de item encontrado                |
| RF03 | Busca de itens (categoria, local, período) |
| RF04 | Reivindicação de posse                     |
| RF05 | Registro de devolução e relatório          |

Requisitos não funcionais: segurança (RNF01) e usabilidade/responsividade em celular (RNF02).

## Tecnologias

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Python, FastAPI
- **Banco de dados:** SQLite

## Estrutura do repositório

```
CampusLost/
├── frontend/   # aplicação web (Next.js)
├── backend/    # API REST (FastAPI)
└── README.md
```

## Como executar

### Frontend com dados simulados (sem backend)

Sem a variável `NEXT_PUBLIC_API_URL`, o frontend usa dados simulados no navegador (é o que roda na hospedagem atual). Requer Node ≥ 20.9.

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

| Comando | Para quê |
|---|---|
| `npm run lint` | análise estática |
| `npm run typecheck` | checagem de tipos |
| `npm run test` | testes das regras de domínio (vitest) |
| `npm run build` / `npm run start` | build e servidor de produção |

- **Roteiro de demonstração:** `docs/prototype/DEMO.md` (perfis de demonstração: usuário institucional, usuário externo e administração; fluxo completo e limitações).
- **Especificação, premissas e critérios de aceite:** `docs/prototype/SPEC.md`; design: `docs/prototype/DESIGN.md`; QA: `docs/prototype/qa/RELATORIO-QA.md`.
- As regras de negócio do protótipo vêm das **recomendações** do documento de decisões, usadas como **premissas** ainda não confirmadas pela equipe. A segurança (RNF01) é apenas simulada.
- Com `NEXT_PUBLIC_API_URL` definida, o frontend passa a usar a API real (ver abaixo).

### Aplicação completa (frontend + backend)

Backend em FastAPI com SQLite (detalhes em `backend/README.md`; contrato da API em `docs/api/API.md`). Requer Python 3.11+.

```bash
# 1) API (http://localhost:8000, documentação em /docs)
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (no Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env           # ajuste as variáveis (no Linux/macOS: cp)
uvicorn app.main:app --reload --port 8000   # em desenvolvimento o banco vazio recebe os dados de exemplo

# 2) Frontend apontando para a API
cd ../frontend
copy .env.example .env.local     # defina NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                      # http://localhost:3000
```

- Contas de demonstração (`*@demo.test`) usam a senha `demonstracao123`.
- Testes do backend: `cd backend && pytest`.
- Login com Google: exige `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) e `GOOGLE_CLIENT_ID` (backend); sem eles o botão não aparece.
- Hospedagem serverless (Vercel) não guarda o SQLite nem as fotos enviadas: para usar a API fora do computador local, ela precisa de um servidor com disco persistente (ver P31 na SPEC).
