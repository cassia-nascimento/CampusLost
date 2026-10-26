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

> Em construção. As instruções completas (instalação, variáveis de ambiente,
> banco, seed e usuários de demonstração) serão adicionadas até 26/10.

### Modo API: proxy same-origin e cabeçalhos de segurança (frontend)

- Com `NEXT_PUBLIC_API_URL` definida, `frontend/next.config.ts` reescreve `/backend/:path*` para
  `${API_INTERNAL_URL}/:path*` (padrão `http://localhost:8000`). `API_INTERNAL_URL` é variável de servidor
  (não `NEXT_PUBLIC_`); veja `frontend/.env.example`. Sem `NEXT_PUBLIC_API_URL` (mock), nada é reescrito.
  O prefixo `/api` não é usado porque `/api/auth/google` pertence ao modo mock.
- Todas as respostas levam CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`
  e, só em produção, HSTS. Limitação: a CSP mantém `'unsafe-inline'` em scripts e estilos (o Next injeta código
  inline); `'unsafe-eval'` só em desenvolvimento.
