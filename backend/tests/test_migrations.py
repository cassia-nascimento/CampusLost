"""B1/9: Alembic. A migração inicial precisa reproduzir exatamente o esquema dos modelos."""

from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError

from app.main import create_app
from app.models import Base
from tests.conftest import FIXED_NOW, Clock, make_settings

BACKEND = Path(__file__).resolve().parent.parent
EXPECTED_TABLES = {"users", "sessions", "email_tokens", "login_attempts", "items", "claims", "returns", "audit_log", "recovery_codes", "admin_invites", "return_codes", "alembic_version"}


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
    with pytest.raises(RuntimeError, match="alembic upgrade head"):  # checagem de esquema recusa banco sem migração
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


def test_0002_upgrades_a_0001_database_keeping_users(tmp_path):
    from sqlalchemy import text

    url = f"sqlite:///{tmp_path / 'old.db'}"
    cfg = alembic_config(url)
    command.upgrade(cfg, "0001")
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO users (id, name, email, role, provider, created_at, token_version) "
            "VALUES ('u1', 'Antiga', 'antiga@exemplo.com', 'student', 'password', '2026-10-01 00:00:00', 0)"
        ))
    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT email, disabled_at, totp_secret, totp_enabled_at FROM users")).one()
    assert tuple(row) == ("antiga@exemplo.com", None, None, None)
    command.downgrade(cfg, "0001")
    assert "audit_log" not in inspect(engine).get_table_names()
    engine.dispose()


def test_0003_converts_roles_and_derives_affiliation(tmp_path, monkeypatch):
    from sqlalchemy import text

    monkeypatch.delenv("GOOGLE_ALLOWED_DOMAINS", raising=False)
    url = f"sqlite:///{tmp_path / 'roles.db'}"
    cfg = alembic_config(url)
    command.upgrade(cfg, "0002")
    engine = create_engine(url)
    old = [
        ("u-stu", "aluna@alunos.undb.edu.br", "student"), ("u-tea", "prof@gmail.com", "teacher"),
        ("u-ext", "ext@undb.edu.br", "external"), ("u-adm1", "chefe@undb.edu.br", "admin"),
        ("u-adm2", "chefe@gmail.com", "admin"), ("u-adm3", "x@evilundb.edu.br", "admin"),
    ]
    with engine.begin() as conn:
        for uid, email, role in old:
            conn.execute(text(
                "INSERT INTO users (id, name, email, role, provider, created_at, token_version) "
                "VALUES (:id, 'N N', :e, :r, 'password', '2026-10-01 00:00:00', 0)"
            ), {"id": uid, "e": email, "r": role})
    command.upgrade(cfg, "head")
    with engine.connect() as conn:
        got = {r[0]: (r[1], r[2]) for r in conn.execute(text("SELECT id, role, affiliation FROM users"))}
    assert got == {
        "u-stu": ("user", "institutional"), "u-tea": ("user", "institutional"),
        "u-ext": ("user", "external"),  # o papel antigo manda: o domínio só é usado para admin
        "u-adm1": ("admin", "institutional"), "u-adm2": ("admin", "external"), "u-adm3": ("admin", "external"),
    }
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == []
    command.downgrade(cfg, "0002")
    with engine.connect() as conn:
        back = {r[0]: r[1] for r in conn.execute(text("SELECT id, role FROM users"))}
        cols = {c["name"] for c in inspect(engine).get_columns("users")}
    assert back == {"u-stu": "student", "u-tea": "student", "u-ext": "external", "u-adm1": "admin", "u-adm2": "admin", "u-adm3": "admin"}
    assert "affiliation" not in cols
    engine.dispose()


def test_0004_preserves_existing_items_and_keeps_stored_at_required(tmp_path):
    from sqlalchemy import text

    url = f"sqlite:///{tmp_path / 'items.db'}"
    cfg = alembic_config(url)
    command.upgrade(cfg, "0003")
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO users (id, name, email, role, affiliation, provider, created_at, token_version) "
            "VALUES ('u1', 'Ana', 'ana@exemplo.com', 'user', 'institutional', 'password', '2026-10-01 00:00:00', 0)"
        ))
        conn.execute(text(
            "INSERT INTO items (id, title, description, category, found_location, found_date, stored_at, photo_url, status, created_by_id, created_at) "
            "VALUES ('i1', 'Chaveiro', 'Chaveiro com três chaves.', 'Chaves', 'Biblioteca', '2026-10-20', 'Portaria', '/uploads/a.jpg', 'available', 'u1', '2026-10-21 10:00:00')"
        ))
    command.upgrade(cfg, "0004")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT id, title, description, category, found_location, found_date, stored_at, photo_url, status, created_by_id, created_at, category_detail FROM items")).one()
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert tuple(row) == ("i1", "Chaveiro", "Chaveiro com três chaves.", "Chaves", "Biblioteca", "2026-10-20", "Portaria", "/uploads/a.jpg", "available", "u1", "2026-10-21 10:00:00", None)
    assert [(d[0], d[1].name) for d in diff] == [("add_table", "return_codes")]  # só falta a 0005
    stored = {c["name"]: c["nullable"] for c in inspect(engine).get_columns("items")}["stored_at"]
    assert stored is False  # o local de guarda continua obrigatório (NOT NULL)
    insert_i2 = (
        "INSERT INTO items (id, title, description, category, category_detail, found_location, found_date, stored_at, status, created_by_id, created_at) "
        "VALUES ('i2', 'Mochila', 'Mochila preta grande.', 'Outros', 'Mochila escolar', :loc, '2026-10-20', :stored, 'available', 'u1', '2026-10-21 11:00:00')"
    )
    loc = "Bloco C, segundo andar, próximo ao laboratório 04"
    with pytest.raises(IntegrityError):  # NULL em stored_at é recusado pelo banco
        with engine.begin() as conn:
            conn.execute(text(insert_i2), {"loc": loc, "stored": None})
    with engine.begin() as conn:  # aceita local de encontro longo (120)
        conn.execute(text(insert_i2), {"loc": loc, "stored": "Secretaria"})
    command.downgrade(cfg, "0003")
    with engine.connect() as conn:
        back = {r[0]: (r[1], r[2]) for r in conn.execute(text("SELECT id, found_location, stored_at FROM items"))}
        cols = {c["name"] for c in inspect(engine).get_columns("items")}
    assert back["i1"] == ("Biblioteca", "Portaria")
    assert back["i2"] == (loc[:40], "Secretaria")
    assert "category_detail" not in cols
    engine.dispose()


def test_0005_creates_return_codes_keeping_all_existing_data(tmp_path):
    from sqlalchemy import text

    url = f"sqlite:///{tmp_path / 'codes.db'}"
    cfg = alembic_config(url)
    command.upgrade(cfg, "0004")
    engine = create_engine(url)
    assert "return_codes" not in inspect(engine).get_table_names()
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO users (id, name, email, role, affiliation, provider, created_at, token_version) "
            "VALUES ('u1', 'Ana', 'ana@exemplo.com', 'user', 'institutional', 'password', '2026-10-01 00:00:00', 0), "
            "('a1', 'Adm', 'adm@exemplo.com', 'admin', 'institutional', 'password', '2026-10-01 00:00:00', 0)"
        ))
        conn.execute(text(
            "INSERT INTO items (id, title, description, category, found_location, found_date, stored_at, status, created_by_id, created_at) "
            "VALUES ('i1', 'Chaveiro', 'Chaveiro com três chaves.', 'Chaves', 'Biblioteca', '2026-10-20', 'Portaria', 'returned', 'a1', '2026-10-21 10:00:00')"
        ))
        conn.execute(text(
            "INSERT INTO claims (id, item_id, claimant_id, proof_details, lost_where_when, status, created_at) "
            "VALUES ('c1', 'i1', 'u1', 'Prova', 'Biblioteca', 'accepted', '2026-10-21 11:00:00')"
        ))
        conn.execute(text(
            "INSERT INTO returns (id, item_id, claim_id, returned_to_id, registered_by_id, returned_at) "
            "VALUES ('r1', 'i1', 'c1', 'u1', 'a1', '2026-10-22 12:00:00')"
        ))
    command.upgrade(cfg, "0005")
    with engine.connect() as conn:
        counts = {t: conn.execute(text(f"SELECT count(*) FROM {t}")).scalar() for t in ("users", "items", "claims", "returns", "return_codes")}
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert counts == {"users": 2, "items": 1, "claims": 1, "returns": 1, "return_codes": 0}  # legado preservado, sem códigos
    assert diff == []
    cols = {c["name"] for c in inspect(engine).get_columns("return_codes")}
    assert cols == {"id", "claim_id", "item_id", "code_hash", "issued_at", "failed_attempts", "locked_until", "verified_at", "verified_by_id", "used_at"}
    with engine.begin() as conn:  # um código por reivindicação (UNIQUE)
        ins = ("INSERT INTO return_codes (id, claim_id, item_id, code_hash, issued_at, failed_attempts) "
               "VALUES (:id, 'c1', 'i1', :h, '2026-10-22 12:00:00', 0)")
        conn.execute(text(ins), {"id": "k1", "h": "0" * 64})
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(text(ins), {"id": "k2", "h": "1" * 64})
    command.downgrade(cfg, "0004")
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM returns")).scalar() == 1
        assert conn.execute(text("SELECT count(*) FROM claims")).scalar() == 1
    assert "return_codes" not in inspect(engine).get_table_names()
    engine.dispose()
