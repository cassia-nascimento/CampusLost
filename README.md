# CampusLost

Sistema de achados e perdidos universitário. Centraliza o registro, a busca, a reivindicação e a devolução de objetos encontrados no campus, para alunos, professores e equipe administrativa.

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

### Protótipo de frontend (sem backend)

O estado atual é um **protótipo navegável do frontend**, com dados simulados no navegador (sem FastAPI, SQLite nem autenticação real). Requer Node ≥ 20.9.

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

- **Roteiro de demonstração:** `docs/prototype/DEMO.md` (perfis de demonstração, fluxo completo e limitações).
- **Especificação, premissas e critérios de aceite:** `docs/prototype/SPEC.md`; design: `docs/prototype/DESIGN.md`; QA: `docs/prototype/qa/RELATORIO-QA.md`.
- As regras de negócio do protótipo vêm das **recomendações** do documento de decisões, usadas como **premissas** ainda não confirmadas pela equipe. A segurança (RNF01) é apenas simulada.
- Trocar os mocks por uma API REST exige alterar apenas `frontend/src/services/index.ts`.

### Aplicação completa (frontend + backend)

> Em construção. As instruções de backend, banco, seed e variáveis de ambiente serão adicionadas até 26/10.
