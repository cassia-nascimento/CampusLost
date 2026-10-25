"""B2/4: cabeçalhos de segurança."""

from __future__ import annotations

from app.main import create_app
from fastapi.testclient import TestClient
from tests.conftest import FIXED_NOW, Clock, make_settings


def test_basic_headers_on_every_response(client):
    for path in ("/health", "/catalog", "/auth/me", "/nao-existe"):
        r = client.get(path)
        assert r.headers["x-content-type-options"] == "nosniff", path
        assert r.headers["x-frame-options"] == "DENY", path
        assert r.headers["referrer-policy"] == "no-referrer", path
        assert "strict-transport-security" not in r.headers, path  # dev/test


def test_no_store_on_auth_me_and_admin(client, admin):
    assert client.get("/auth/me").headers["cache-control"] == "no-store"  # inclusive no 401
    assert client.post("/auth/login", json={"email": "x@y.com", "password": "abc"}).headers["cache-control"] == "no-store"
    assert client.get("/me/export", headers=admin).headers["cache-control"] == "no-store"
    assert client.get("/admin/users", headers=admin).headers["cache-control"] == "no-store"
    assert "cache-control" not in client.get("/health").headers
    assert "cache-control" not in client.get("/catalog").headers


def test_no_duplicate_cache_control_header(client, admin):
    r = client.get("/me/export", headers=admin)
    assert len(r.headers.get_list("cache-control")) == 1


def test_hsts_outside_development(tmp_path):
    settings = make_settings(tmp_path, env="production", demo_mode=False, seed_on_startup=False, mail_backend="console")
    from app.db import make_engine
    from app.models import Base

    Base.metadata.create_all(make_engine(settings))
    with TestClient(create_app(settings, clock=Clock(FIXED_NOW))) as c:
        r = c.get("/health")
        assert r.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"
        assert r.headers["x-frame-options"] == "DENY"


def test_options_preflight_allows_patch(client):
    r = client.options(
        "/admin/users/x",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "PATCH"},
    )
    assert r.status_code == 200 and "PATCH" in r.headers["access-control-allow-methods"]
