"""B1/9: Alembic. A migração inicial precisa reproduzir exatamente o esquema dos modelos."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

from app.main import create_app
from app.models import Base
from tests.conftest import FIXED_NOW, Clock, make_settings

BACKEND = Path(__file__).resolve().parent.parent
EXPECTED_TABLES = {"users", "sessions", "email_tokens", "login_attempts", "items", "claims", "returns", "alembic_version"}


def alembic_config(url: str) -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    cfg.attributes["url"] = url
    cfg.attributes["configure_logger"] = False
    return cfg


def test_there_is_a_single_head():
    assert len(ScriptDirectory.from_config(alembic_config("sqlite://")).get_heads()) == 1


def test_upgrade_creates_the_exact_model_schema_and_downgrade_removes_it(tmp_path):
    url = f"sqlite:///{tmp_path / 'mig.db'}"
    cfg = alembic_config(url)
    command.upgrade(cfg, "head")
    engine = create_engine(url)
    assert set(inspect(engine).get_table_names()) == EXPECTED_TABLES
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == [], diff  # o modelo e a migração não divergem
    command.downgrade(cfg, "base")
    assert set(inspect(engine).get_table_names()) <= {"alembic_version"}
    engine.dispose()


def test_migrated_database_works_with_the_app(tmp_path):
    from fastapi.testclient import TestClient

    url = f"sqlite:///{tmp_path / 'mig.db'}"
    command.upgrade(alembic_config(url), "head")
    settings = make_settings(tmp_path, database_url=url)
    with TestClient(create_app(settings, clock=Clock(FIXED_NOW))) as c:
        assert c.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"}).status_code == 200


def test_production_does_not_create_tables_automatically(tmp_path):
    url = f"sqlite:///{tmp_path / 'prod.db'}"
    settings = make_settings(tmp_path, env="production", demo_mode=False, seed_on_startup=False, database_url=url)
    create_app(settings, clock=Clock(FIXED_NOW))
    engine = create_engine(url)
    assert inspect(engine).get_table_names() == []  # o esquema vem só do `alembic upgrade head`
    engine.dispose()


def test_dev_and_test_still_use_create_all(tmp_path):
    url = f"sqlite:///{tmp_path / 'dev.db'}"
    create_app(make_settings(tmp_path, env="development", database_url=url), clock=Clock(FIXED_NOW))
    engine = create_engine(url)
    assert set(inspect(engine).get_table_names()) == EXPECTED_TABLES - {"alembic_version"}
    engine.dispose()
