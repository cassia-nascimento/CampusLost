"""Comportamento HTTP geral: formato de erro, CORS, cabeçalhos, erros internos."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import FIXED_NOW, Clock


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_unknown_route_and_method_use_error_shape(client):
    r = client.get("/nao-existe")
    assert r.status_code == 404 and r.json() == {"code": "NOT_FOUND", "message": "Recurso não encontrado."}
    r = client.delete("/catalog")
    assert r.status_code == 405 and set(r.json()) == {"code", "message"}


def test_internal_errors_do_not_leak_details(app):
    @app.get("/boom")
    def boom():
        raise RuntimeError("segredo-interno /home/x/db.sqlite")

    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.get("/boom")
    assert r.status_code == 500
    assert r.json() == {"code": "UNEXPECTED", "message": "Algo deu errado. Tente novamente."}
    assert "segredo" not in r.text and "Traceback" not in r.text


def test_cors_only_for_configured_origins(client):
    ok = client.get("/items", headers={"Origin": "http://localhost:3000"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    bad = client.get("/items", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in bad.headers
    pre = client.options(
        "/items",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization"},
    )
    assert pre.status_code == 200 and "authorization" in pre.headers["access-control-allow-headers"].lower()


def test_cors_origins_configurable(tmp_path):
    from tests.conftest import make_settings

    s = make_settings(tmp_path, cors_origins=("https://campuslost.exemplo",))
    with TestClient(create_app(s, clock=Clock(FIXED_NOW))) as c:
        assert c.get("/items", headers={"Origin": "https://campuslost.exemplo"}).headers["access-control-allow-origin"] == "https://campuslost.exemplo"
        assert "access-control-allow-origin" not in c.get("/items", headers={"Origin": "http://localhost:3000"}).headers


def test_validation_error_for_wrong_body_type(client):
    r = client.post("/auth/login", json=["a", "b"])
    assert r.status_code == 422 and r.json()["code"] == "VALIDATION"


def test_sql_injection_strings_are_just_data(client, student, admin):
    r = client.get("/items", params={"category": "x' OR '1'='1"})
    assert r.status_code == 422
    r = client.post("/auth/login", json={"email": "a@b.co' OR 1=1 --", "password": "x"})
    assert r.status_code == 422
    item = client.post("/items", data={"title": "Robert'); DROP TABLE items;--", "description": "descrição com aspas ' e \" ok", "category": "Outros", "foundLocation": "Cantina", "foundDate": "2026-10-20", "storedAt": "Portaria"}, headers=student)
    assert item.status_code == 201
    assert len(client.get("/items").json()) == 10


def test_item_json_dates_are_iso_8601_utc(client, admin):
    import re

    for it in client.get("/items", headers=admin).json():
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z", it["createdAt"])
        assert re.fullmatch(r"\d{4}-\d{2}-\d{2}", it["foundDate"])
