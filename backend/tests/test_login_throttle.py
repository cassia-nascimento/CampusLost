"""B1/7: limite de login persistido (e-mail + IP, bloqueio progressivo) e ponto de extensão Turnstile."""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import turnstile
from app.main import create_app
from app.models import LoginAttemptRow
from tests.conftest import DEMO_PASSWORD, FIXED_NOW, Clock, make_settings
from tests.helpers import signup_payload

BAD = {"email": "marina@demo.test", "password": "senha-errada-1"}
GOOD = {"email": "marina@demo.test", "password": DEMO_PASSWORD}


def fail(client, n, body=BAD):
    for _ in range(n):
        assert client.post("/auth/login", json=body).status_code == 401


def test_blocks_after_limit_even_with_correct_password_and_other_email_is_free(client):
    fail(client, 10)
    r = client.post("/auth/login", json=BAD)
    assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED" and int(r.headers["Retry-After"]) >= 1
    assert client.post("/auth/login", json=GOOD).status_code == 429
    assert client.post("/auth/login", json={"email": "rafael@demo.test", "password": DEMO_PASSWORD}).status_code == 200


def test_state_is_persisted_in_the_database_and_survives_a_restart(settings, clock):
    with TestClient(create_app(settings, clock=clock)) as c1:
        fail(c1, 10)
        assert c1.post("/auth/login", json=GOOD).status_code == 429
    with TestClient(create_app(settings, clock=clock)) as c2:  # "reinício": outro processo, mesmo banco
        assert c2.post("/auth/login", json=GOOD).status_code == 429
        engine = c2.app.state.session_factory
        with engine() as s:
            row = s.scalar(select(LoginAttemptRow))
            assert row.email == "marina@demo.test" and row.failures == 10 and row.locked_until is not None
            assert row.ip == "testclient"  # chave = (e-mail, IP)


def test_lock_is_progressive_and_expires(client, clock):
    fail(client, 10)
    r = client.post("/auth/login", json=GOOD)
    assert 59 <= int(r.headers["Retry-After"]) <= 61
    clock.advance(seconds=61)
    assert client.post("/auth/login", json=BAD).status_code == 401  # 1 falha depois do bloqueio...
    r = client.post("/auth/login", json=GOOD)  # ...já bloqueia de novo, agora por 2 minutos
    assert r.status_code == 429 and 119 <= int(r.headers["Retry-After"]) <= 121
    clock.advance(seconds=121)
    assert client.post("/auth/login", json=BAD).status_code == 401
    r = client.post("/auth/login", json=GOOD)
    assert r.status_code == 429 and 239 <= int(r.headers["Retry-After"]) <= 241
    clock.advance(seconds=241)
    assert client.post("/auth/login", json=GOOD).status_code == 200  # senha certa depois do bloqueio entra


def test_lock_duration_doubles_up_to_the_cap(client, clock, settings):
    waits = []
    for _ in range(9):
        for _ in range(12):
            r = client.post("/auth/login", json=BAD)
            if r.status_code == 429:
                break
        assert r.status_code == 429
        waits.append(int(r.headers["Retry-After"]))
        clock.advance(seconds=waits[-1] + 1)
    assert [round(w, -1) for w in waits[:4]] == [60, 120, 240, 480]
    assert max(waits) <= settings.login_lock_max_seconds + 1 and waits[-1] >= settings.login_lock_max_seconds


def test_failures_decay_after_quiet_period(client, clock):
    fail(client, 9)
    clock.advance(minutes=16)
    fail(client, 9)  # contagem recomeçou: ainda não bloqueou
    assert client.post("/auth/login", json=GOOD).status_code == 200


def test_success_resets_the_counter(client):
    fail(client, 9)
    assert client.post("/auth/login", json=GOOD).status_code == 200
    fail(client, 9)
    assert client.post("/auth/login", json=GOOD).status_code == 200


def test_unknown_email_is_throttled_the_same_way(client):
    body = {"email": "fantasma@exemplo.com", "password": "senha-errada-1"}
    fail(client, 10, body)
    assert client.post("/auth/login", json=body).status_code == 429


def test_email_in_key_is_case_and_space_insensitive(client):
    fail(client, 5, {"email": "MARINA@demo.test", "password": "senha-errada-1"})
    fail(client, 5, {"email": " marina@demo.test ", "password": "senha-errada-1"})
    assert client.post("/auth/login", json=GOOD).status_code == 429


def test_validation_errors_do_not_count_as_failures(client):
    for _ in range(15):
        assert client.post("/auth/login", json={"email": "marina@demo.test", "password": ""}).status_code == 422
    assert client.post("/auth/login", json=GOOD).status_code == 200


def test_old_rows_are_pruned(client, app, clock):
    fail(client, 1, {"email": "velho@exemplo.com", "password": "senha-errada-1"})
    clock.advance(days=2)
    fail(client, 1)
    with app.state.session_factory() as s:
        assert [r.email for r in s.scalars(select(LoginAttemptRow))] == ["marina@demo.test"]


def test_limit_zero_disables(tmp_path):
    with TestClient(create_app(make_settings(tmp_path, login_rate_limit=0), clock=Clock(FIXED_NOW))) as c:
        fail(c, 15)


# --- Turnstile ---------------------------------------------------------------------------------------------------


@pytest.fixture
def captcha_client(tmp_path, monkeypatch):
    calls = []

    def fake(settings, token, ip):
        calls.append((token, ip))
        return {"success": token == "bom"}

    monkeypatch.setattr(turnstile, "_siteverify", fake)
    with TestClient(create_app(make_settings(tmp_path, turnstile_secret="segredo-de-teste"), clock=Clock(FIXED_NOW))) as c:
        c.calls = calls
        yield c


def test_turnstile_off_by_default_needs_no_token(client):
    assert client.post("/auth/login", json=GOOD).status_code == 200
    assert client.post("/auth/signup", json=signup_payload("t@exemplo.com")).status_code == 201


def test_turnstile_on_requires_valid_token_on_all_sensitive_endpoints(captcha_client):
    c = captcha_client
    for path, body in (
        ("/auth/login", GOOD),
        ("/auth/signup", signup_payload("t@exemplo.com")),
        ("/auth/forgot-password", {"email": "marina@demo.test"}),
        ("/auth/resend-verification", {"email": "marina@demo.test"}),
    ):
        c.cookies.clear()  # o signup anterior deixou cookies de sessão; aqui testamos só o captcha
        for extra in ({}, {"turnstileToken": ""}, {"turnstileToken": "ruim"}):
            r = c.post(path, json={**body, **extra})
            assert r.status_code == 400 and r.json()["code"] == "CAPTCHA_FAILED", (path, extra)
        r = c.post(path, json={**body, "turnstileToken": "bom"})
        assert r.status_code in (200, 201, 202), (path, r.text)
    assert c.calls[-1][1] == "testclient"  # IP repassado ao verificador


def test_turnstile_fails_closed_when_cloudflare_is_unreachable(tmp_path, monkeypatch):
    def boom(settings, token, ip):
        raise httpx.ConnectError("sem rede")

    monkeypatch.setattr(turnstile, "_siteverify", boom)
    with TestClient(create_app(make_settings(tmp_path, turnstile_secret="x"), clock=Clock(FIXED_NOW))) as c:
        r = c.post("/auth/login", json={**GOOD, "turnstileToken": "bom"})
        assert r.status_code == 400 and r.json()["code"] == "CAPTCHA_FAILED"


def test_turnstile_does_not_apply_to_other_routes(captcha_client):
    assert captcha_client.get("/items").status_code == 200
    assert captcha_client.post("/demo/login/student").status_code == 200


def test_turnstile_secret_comes_from_env_and_is_not_in_repr():
    from app.config import load_settings

    s = load_settings({"TURNSTILE_SECRET": "abc"}, read_dotenv=False)
    assert s.turnstile_secret == "abc" and "abc" not in repr(s)
    assert load_settings({}, read_dotenv=False).turnstile_secret == ""


def test_turnstile_hostname_allowlist(tmp_path, monkeypatch):
    def fake(settings, token, ip):
        return {"success": True, "hostname": token}  # o "token" carrega o hostname devolvido pela Cloudflare

    monkeypatch.setattr(turnstile, "_siteverify", fake)
    settings = make_settings(tmp_path, turnstile_secret="s", turnstile_hostnames=("meu-site.vercel.app",))
    with TestClient(create_app(settings, clock=Clock(FIXED_NOW))) as c:
        ok = c.post("/auth/login", json={**GOOD, "turnstileToken": "Meu-Site.vercel.app"})
        assert ok.status_code == 200
        bad = c.post("/auth/login", json={**GOOD, "turnstileToken": "outro-site.com"})
        assert bad.status_code == 400 and bad.json()["code"] == "CAPTCHA_FAILED"
