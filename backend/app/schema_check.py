"""Checagem de esquema na subida: avisa quando o banco é de uma versão antiga dos modelos.

`Base.metadata.create_all` só cria tabelas que faltam; nunca altera as existentes. Um banco criado por uma versão
anterior (ex.: sem `users.affiliation`) subiria "normal" e falharia depois, em tempo de consulta (500). Aqui a falha
é imediata e explicada. Esta função só LÊ o banco: nunca apaga nem altera nada.
"""

from __future__ import annotations

from sqlalchemy import Engine, inspect

from .models import Base


class SchemaOutdatedError(RuntimeError):
    """O banco existente não tem tabelas/colunas que os modelos atuais esperam."""


def missing_schema(engine: Engine) -> list[str]:
    """`tabela` (tabela ausente) ou `tabela.coluna` (coluna ausente), em ordem estável. Extras no banco são ignoradas."""
    insp = inspect(engine)
    existing = set(insp.get_table_names())
    missing: list[str] = []
    for table in Base.metadata.sorted_tables:
        if table.name not in existing:
            missing.append(table.name)
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        missing += [f"{table.name}.{c.name}" for c in table.columns if c.name not in have]
    return missing


def ensure_schema_current(engine: Engine) -> None:
    missing = missing_schema(engine)
    if not missing:
        return
    url = engine.url
    db_file = url.database if url.get_backend_name() == "sqlite" and url.database not in (None, "", ":memory:") else None
    reset = (
        f"apague o arquivo do banco ({db_file}) para ele ser recriado com os dados de demonstração"
        if db_file
        else "apague e recrie o banco para ele ser gerado com os dados de demonstração"
    )
    raise SchemaOutdatedError(
        "O banco de dados está desatualizado em relação ao código. "
        f"Faltando: {', '.join(missing)}. "
        f"Em desenvolvimento/demonstração, pare a API e {reset}. "
        "Se os dados precisam ser mantidos, rode `alembic upgrade head`."
    )
