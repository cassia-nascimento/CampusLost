"""Seed determinístico, modo demonstração e configuração de produção."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.config import ConfigError, load_settings
from app.main import create_app
from app.models import ClaimRow, ItemRow, ReturnRow, UserRow
from app.seed import DEMO_PASSWORD, seed_database
from tests.conftest import FIXED_NOW, ITEM_FORM, JPEG, Clock, login, make_settings


def snapshot(client):
    """Tudo que a administração enxerga, em ordem estável."""
    h = login(client, "admin")
    items = client.get("/items", headers=h).json()
    returned = [client.get(f"/items/{i}", headers=h).json() for i in ("item-10", "item-11")]
    return {
        "items": items,
        "returned": returned,
        "pending": client.get("/claims/pending", headers=h).json(),
        "returns": client.get("/returns", headers=h).json(),
        "details": [client.get(f"/items/{i['id']}", headers=h).json() for i in items],
    }


def test_seed_counts_and_status_coverage(app):
    with app.state.session_factory() as s:
        count = lambda m: s.scalar(select(func.count()).select_from(m))  # noqa: E731
        assert (count(UserRow), count(ItemRow), count(ClaimRow), count(ReturnRow)) == (6, 11, 9, 2)
        statuses = {i.status for i in s.scalars(select(ItemRow))}
        assert statuses == {"available", "under_claim", "returned"}
        claim_statuses = {c.status for c in s.scalars(select(ClaimRow))}
        assert claim_statuses == {"pending", "accepted", "rejected"}
        users = {u.id: u for u in s.scalars(select(UserRow))}
        assert set(users) == {"user-marina", "user-rafael", "user-admin", "user-lucas", "user-beatriz", "user-externo"}
        assert users["user-admin"].role == "admin" and users["user-admin"].email == "admin@demo.test"
        assert all(u.email.endswith("@demo.test") for u in users.values())


def test_seed_matches_frontend_mock_data(client):
    items = {i["id"]: i for i in client.get("/items", headers=login(client, "admin")).json()}
    assert sorted(items) == ["item-01", "item-02", "item-03", "item-04", "item-05", "item-06", "item-07", "item-08", "item-09"]
    assert items["item-01"]["title"] == "Fones de ouvido sem fio"
    assert items["item-01"]["photoUrl"] == "/uploads/seed/fones-de-ouvido.svg"
    assert items["item-03"]["status"] == "under_claim" and items["item-04"]["status"] == "available"
    assert items["item-01"]["foundDate"] == "2026-10-22"  # hoje
    assert items["item-09"]["foundDate"] == "2026-10-11"  # 11 dias antes
    assert items["item-01"]["createdAt"] == "2026-10-22T12:00:00.000Z"  # 3 h antes de 15:00Z
    admin = login(client, "admin")
    ret = client.get("/returns", headers=admin).json()
    assert [(r["id"], r["itemId"], r["claimId"], r["returnedToId"]) for r in ret] == [
        ("return-01", "item-10", "claim-08", "user-beatriz"),
        ("return-02", "item-11", "claim-09", "user-rafael"),
    ]
    assert ret[0]["returnedAt"] == "2026-10-17T15:00:00.000Z"
    assert client.get("/items/item-11", headers=admin).json()["item"]["foundDate"] == "2026-10-07"


def test_seed_is_deterministic_for_a_fixed_clock(tmp_path):
    snaps = []
    for n in range(2):
        s = make_settings(tmp_path / f"run{n}")
        with TestClient(create_app(s, clock=Clock(FIXED_NOW))) as c:
            snaps.append(snapshot(c))
    assert snaps[0] == snaps[1]


def test_seed_dates_are_relative_to_today(tmp_path):
    from datetime import datetime

    s = make_settings(tmp_path)
    with TestClient(create_app(s, clock=Clock(datetime(2027, 3, 5, 15, 0, 0)))) as c:
        items = {i["id"]: i for i in c.get("/items").json()}
        assert items["item-01"]["foundDate"] == "2027-03-05"
        assert items["item-09"]["foundDate"] == "2027-02-22"


def test_all_demo_accounts_use_the_demo_password(client):
    for email in ("marina", "rafael", "admin", "lucas", "beatriz"):
        r = client.post("/auth/login", json={"email": f"{email}@demo.test", "password": DEMO_PASSWORD})
        assert r.status_code == 200, email
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao1236"}).status_code == 401


def test_demo_profiles_and_login(client):
    r = client.get("/demo/profiles")
    assert r.status_code == 200
    assert r.json() == [
        {"role": "student", "label": "Entrar como aluno", "user": {"id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "student"}},
        {"role": "teacher", "label": "Entrar como professor", "user": {"id": "user-rafael", "name": "Rafael Lima", "email": "rafael@demo.test", "role": "teacher"}},
        {"role": "admin", "label": "Entrar como administração", "user": {"id": "user-admin", "name": "Administração Demo", "email": "admin@demo.test", "role": "admin"}},
    ]
    for role, uid in (("student", "user-marina"), ("teacher", "user-rafael"), ("admin", "user-admin")):
        body = client.post(f"/demo/login/{role}").json()
        assert body["user"]["id"] == uid
        me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
        assert me.json()["id"] == uid
    assert client.post("/demo/login/root").status_code == 404


def test_demo_reset_restores_seed_and_removes_uploads(client, student, admin, settings):
    before = snapshot(client)
    created = client.post("/items", data=ITEM_FORM, files={"photo": ("a.jpg", JPEG, "image/jpeg")}, headers=student).json()
    client.post("/claims/claim-01/accept", headers=admin)
    client.delete("/items/item-02", headers=admin)
    new_user = client.post("/auth/signup", json={"name": "Nova Pessoa", "email": "nova@exemplo.com", "password": "senha-forte-1", "role": "student", "acceptTerms": True}).json()
    photo = settings.uploads_dir / created["photoUrl"].split("/")[-1]
    assert photo.exists()

    r = client.post("/demo/reset")
    assert r.status_code == 204
    assert snapshot(client) == before
    assert not photo.exists()
    assert (settings.uploads_dir / "seed" / "oculos.svg").exists()
    # a sessão de um perfil de demonstração continua valendo; a do usuário criado cai
    assert client.get("/auth/me", headers=student).status_code == 200
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"}).status_code == 401


def test_seed_database_function_is_idempotent(app, settings):
    with app.state.session_factory() as s:
        seed_database(s, settings, FIXED_NOW)
        seed_database(s, settings, FIXED_NOW)
        assert s.scalar(select(func.count()).select_from(ItemRow)) == 11


def test_seed_not_applied_when_db_has_data_or_startup_seed_off(tmp_path):
    s = make_settings(tmp_path, seed_on_startup=False)
    with TestClient(create_app(s, clock=Clock(FIXED_NOW))) as c:
        assert c.get("/items").json() == []
        assert c.post("/demo/login/student").status_code == 404  # sem usuários


# ---------- produção ----------
def prod_settings(tmp_path):
    return make_settings(tmp_path, env="production", demo_mode=False, seed_on_startup=False)


def test_demo_endpoints_are_off_in_production(tmp_path):
    with TestClient(create_app(prod_settings(tmp_path), clock=Clock(FIXED_NOW))) as c:
        for method, path in (("GET", "/demo/profiles"), ("POST", "/demo/login/admin"), ("POST", "/demo/reset")):
            r = c.request(method, path)
            assert r.status_code == 404, path
            assert r.json()["code"] == "NOT_FOUND"
        assert c.get("/health").status_code == 200
        assert c.get("/docs").status_code == 404 and c.get("/openapi.json").status_code == 404


SMTP_ENV = {"SMTP_HOST": "smtp.exemplo.test", "SMTP_FROM": "CampusLost <nao-responda@exemplo.test>"}


def test_production_refuses_to_start_without_secret():
    with pytest.raises(ConfigError):
        load_settings({"ENV": "production"}, read_dotenv=False)
    with pytest.raises(ConfigError):
        load_settings({"ENV": "production", "SECRET_KEY": "curta"}, read_dotenv=False)
    with pytest.raises(ConfigError):  # produção sem e-mail real (SMTP) não sobe: links de acesso iriam para o log
        load_settings({"ENV": "production", "SECRET_KEY": "x" * 40}, read_dotenv=False)
    ok = load_settings({"ENV": "production", "SECRET_KEY": "x" * 40, **SMTP_ENV}, read_dotenv=False)
    assert ok.is_production and ok.demo_mode is False and ok.seed_on_startup is False


def test_dev_defaults_and_warning(caplog):
    with caplog.at_level("WARNING", logger="campuslost"):
        s = load_settings({}, read_dotenv=False)
    assert s.env == "development" and s.demo_mode is True
    assert "INSEGURA" in caplog.text.upper() or "insegura" in caplog.text
    assert s.google_allowed_domains == ("undb.edu.br",) and s.cors_origins == ("http://localhost:3000",)


def test_env_overrides():
    s = load_settings(
        {"DEMO_MODE": "false", "CORS_ORIGINS": "https://a.com, https://b.com", "GOOGLE_ALLOWED_DOMAINS": "x.edu.br,y.edu.br",
         "ACCESS_TOKEN_EXPIRE_MINUTES": "5", "DATABASE_URL": "sqlite:///foo.db", "GOOGLE_CLIENT_ID": "abc"},
        read_dotenv=False,
    )
    assert s.demo_mode is False and s.cors_origins == ("https://a.com", "https://b.com")
    assert s.google_allowed_domains == ("x.edu.br", "y.edu.br") and s.access_token_expire_minutes == 5
    assert s.database_url == "sqlite:///foo.db" and s.google_client_id == "abc"
    prod_demo = load_settings({"ENV": "production", "SECRET_KEY": "x" * 40, "DEMO_MODE": "true", **SMTP_ENV}, read_dotenv=False)
    assert prod_demo.demo_mode is True  # explícito vence o padrão


def test_sqlite_pragmas(app):
    from sqlalchemy import text

    with app.state.engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert conn.execute(text("PRAGMA journal_mode")).scalar().lower() == "wal"
