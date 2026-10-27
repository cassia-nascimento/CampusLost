"""Checagem de esquema na subida: banco antigo falha cedo, com mensagem acionável; nunca altera o banco."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.main import create_app
from app.models import Base
from app.schema_check import SchemaOutdatedError, ensure_schema_current
from tests.conftest import make_settings


def _engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'x.db'}")
    Base.metadata.create_all(engine)
    return engine


def test_banco_novo_passa(tmp_path):
    ensure_schema_current(_engine(tmp_path))


def test_banco_em_memoria_passa():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    ensure_schema_current(engine)


def test_coluna_removida_levanta_com_lista_e_instrucoes(tmp_path):
    engine = _engine(tmp_path)
    with engine.begin() as c:
        c.execute(text("ALTER TABLE users DROP COLUMN affiliation"))
    with pytest.raises(SchemaOutdatedError) as exc:
        ensure_schema_current(engine)
    msg = str(exc.value)
    assert "users.affiliation" in msg
    assert "alembic upgrade head" in msg
    assert str(tmp_path / "x.db") in msg
    assert isinstance(exc.value, RuntimeError)


def test_tabela_ausente_e_listada(tmp_path):
    engine = _engine(tmp_path)
    with engine.begin() as c:
        c.execute(text("DROP TABLE audit_log"))
    with pytest.raises(SchemaOutdatedError, match="audit_log"):
        ensure_schema_current(engine)


def test_coluna_e_tabela_extras_sao_ignoradas(tmp_path):
    engine = _engine(tmp_path)
    with engine.begin() as c:
        c.execute(text("ALTER TABLE users ADD COLUMN legado TEXT"))
        c.execute(text("CREATE TABLE tabela_antiga (id INTEGER)"))
    ensure_schema_current(engine)


def test_create_app_recusa_banco_antigo_sem_altera_lo(tmp_path):
    settings = make_settings(tmp_path)
    create_app(settings)  # cria e semeia
    engine = create_engine(settings.database_url)
    with engine.begin() as c:
        c.execute(text("ALTER TABLE users DROP COLUMN affiliation"))
    with pytest.raises(SchemaOutdatedError, match="users.affiliation"):
        create_app(settings)
    cols = [r[1] for r in engine.connect().execute(text("PRAGMA table_info(users)"))]
    assert "affiliation" not in cols  # nada foi recriado/alterado automaticamente
    assert (tmp_path / "test.db").exists()


def test_producao_sem_migracao_recusa_subir(tmp_path):
    settings = make_settings(tmp_path, env="production", demo_mode=False, seed_on_startup=False)
    with pytest.raises(SchemaOutdatedError, match="alembic upgrade head"):
        create_app(settings)
