"""B1/6: cookies HttpOnly, refresh rotativo, logout, CSRF; Bearer continua funcionando."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

import jwt
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import create_app
from app.models import SessionRow
from tests.conftest import DEMO_PASSWORD, FIXED_NOW, ITEM_FORM, Clock, make_settings
from tests.helpers import CLAIM, bearer

XRW = {"X-Requested-With": "XMLHttpRequest"}


def do_login(client, email="marina@demo.test"):
    r = client.post("/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    return r


def set_cookie_headers(r):
    return {h.split("=", 1)[0]: h for h in r.headers.get_list("set-cookie")}


def test_login_sets_httponly_samesite_lax_cookies_and_still_returns_bearer(client):
    r = do_login(client)
    assert r.json()["tokenType"] == "bearer" and r.json()["token"]
    cookies = set_cookie_headers(r)
    access, refresh = cookies["cl_access"].lower(), cookies["cl_refresh"].lower()
    for c in (access, refresh):
        assert "httponly" in c and "samesite=lax" in c and "secure" not in c  # test/dev: sem Secure
    assert "max-age=900" in access and "path=/;" in access + ";"
    assert "max-age=604800" in refresh and "path=/auth" in refresh


def test_cookies_are_secure_outside_dev(tmp_path):
    for env, expected in (("development", False), ("test", False), ("staging", True), ("production", True)):
        assert make_settings(tmp_path, env=env).use_secure_cookies is expected
    assert make_settings(tmp_path, env="test", cookie_secure=True).use_secure_cookies is True
    with TestClient(create_app(make_settings(tmp_path, cookie_secure=True), clock=Clock(FIXED_NOW))) as c:
        r = do_login(c)
        assert all("secure" in h.lower() for h in r.headers.get_list("set-cookie"))


def test_access_token_in_cookie_is_short_lived_and_bound_to_a_session(client, settings):
    do_login(client)
    claims = jwt.decode(client.cookies.get("cl_access"), settings.secret_key, algorithms=["HS256"])
    assert claims["exp"] - claims["iat"] == 15 * 60 and claims["typ"] == "access" and claims["sid"].startswith("sess-")


def test_cookie_authenticates_without_authorization_header(client):
    do_login(client)
    me = client.get("/auth/me")
    assert me.status_code == 200 and me.json()["email"] == "marina@demo.test"
    assert client.get("/claims/mine").status_code == 200


def test_bearer_takes_precedence_over_cookie(client):
    do_login(client, "marina@demo.test")  # cookie = Marina
    admin = client.post("/demo/login/admin").json()["token"]
    assert client.get("/auth/me", headers=bearer(admin)).json()["role"] == "admin"


def test_cookie_requests_that_change_data_need_csrf_header(client):
    do_login(client)
    r = client.post("/items/item-01/claims", json=CLAIM)  # só cookie, sem X-Requested-With
    assert r.status_code == 403 and r.json()["code"] == "CSRF_FAILED"
    r = client.post("/items", data=ITEM_FORM)
    assert r.status_code == 403 and r.json()["code"] == "CSRF_FAILED"
    ok = client.post("/items/item-01/claims", json=CLAIM, headers=XRW)
    assert ok.status_code == 201
    # leituras não exigem o cabeçalho
    assert client.get("/claims/mine").status_code == 200


def test_cookie_csrf_rejects_foreign_origin_even_with_header(client):
    do_login(client)
    r = client.post("/items/item-01/claims", json=CLAIM, headers={**XRW, "Origin": "https://evil.example"})
    assert r.status_code == 403 and r.json()["code"] == "CSRF_FAILED"
    ok = client.post("/items/item-01/claims", json=CLAIM, headers={**XRW, "Origin": "http://localhost:3000"})
    assert ok.status_code == 201


def test_bearer_requests_do_not_need_csrf_header(client):
    token = do_login(client).json()["token"]
    client.cookies.clear()
    assert client.post("/items/item-01/claims", json=CLAIM, headers=bearer(token)).status_code == 201


def test_invalid_access_cookie_is_treated_as_guest_but_me_is_401(client, settings):
    now = datetime.now(UTC)
    expired = jwt.encode({"sub": "user-marina", "typ": "access", "tv": 0, "iat": now - timedelta(hours=1), "exp": now - timedelta(minutes=1)}, settings.secret_key, algorithm="HS256")
    client.cookies.set("cl_access", expired)
    assert client.get("/auth/me").status_code == 401
    assert client.get("/items").status_code == 200  # navegação pública não quebra
    client.cookies.set("cl_access", "lixo")
    assert client.get("/auth/me").status_code == 401


def test_refresh_rotates_and_issues_new_cookies(client, app):
    do_login(client)
    old_refresh, old_access = client.cookies.get("cl_refresh"), client.cookies.get("cl_access")
    r = client.post("/auth/refresh", headers=XRW)
    assert r.status_code == 200 and r.json()["user"]["email"] == "marina@demo.test" and r.json()["token"]
    new_refresh = client.cookies.get("cl_refresh")
    assert new_refresh and new_refresh != old_refresh
    assert {"cl_access", "cl_refresh"} <= set(set_cookie_headers(r))
    assert client.get("/auth/me").status_code == 200
    with app.state.session_factory() as s:  # só hashes no banco
        rows = s.scalars(select(SessionRow).where(SessionRow.user_id == "user-marina")).all()
        hashes = {r.refresh_hash for r in rows}
        assert hashlib.sha256(new_refresh.encode()).hexdigest() in hashes
        assert all(old_refresh not in h and new_refresh not in h for h in hashes)
    assert old_access  # emitido antes continua válido até expirar (stateless), mas a sessão é a mesma


def test_refresh_requires_csrf_header_and_a_cookie(client):
    assert client.post("/auth/refresh", headers=XRW).status_code == 401  # sem cookie
    do_login(client)
    r = client.post("/auth/refresh")
    assert r.status_code == 403 and r.json()["code"] == "CSRF_FAILED"


def test_reusing_an_old_refresh_token_revokes_the_session(client, clock):
    first = do_login(client)
    stolen = client.cookies.get("cl_refresh")
    assert client.post("/auth/refresh", headers=XRW).status_code == 200  # uso legítimo rotaciona
    clock.advance(minutes=1)
    client.cookies.set("cl_refresh", stolen, path="/auth")  # atacante reapresenta o antigo
    assert client.post("/auth/refresh", headers=XRW).status_code == 401
    # a sessão inteira caiu: nem o refresh novo nem o Bearer da sessão funcionam
    assert client.get("/auth/me", headers=bearer(first.json()["token"])).status_code == 401


def test_double_refresh_within_grace_does_not_kill_session(client, clock):
    do_login(client)
    stale = client.cookies.get("cl_refresh")
    assert client.post("/auth/refresh", headers=XRW).status_code == 200
    fresh = client.cookies.get("cl_refresh")
    clock.advance(seconds=3)
    client.cookies.set("cl_refresh", stale, path="/auth")  # segunda aba ainda com o cookie antigo
    assert client.post("/auth/refresh", headers=XRW).status_code == 401
    client.cookies.set("cl_refresh", fresh, path="/auth")
    assert client.post("/auth/refresh", headers=XRW).status_code == 200  # sessão viva


def test_refresh_expires_after_seven_days_and_slides_when_used(client, clock):
    do_login(client)
    clock.advance(days=6)
    assert client.post("/auth/refresh", headers=XRW).status_code == 200  # renova por mais 7 dias
    clock.advance(days=6)
    assert client.post("/auth/refresh", headers=XRW).status_code == 200
    clock.advance(days=7, seconds=1)
    assert client.post("/auth/refresh", headers=XRW).status_code == 401


def test_logout_revokes_bearer_and_cookie_session_and_clears_cookies(client, app):
    r = do_login(client)
    h = bearer(r.json()["token"])
    out = client.post("/auth/logout", headers={**h, **XRW})
    assert out.status_code == 204
    cleared = [x.lower() for x in out.headers.get_list("set-cookie")]
    assert len(cleared) == 2 and all("max-age=0" in c for c in cleared)
    assert client.get("/auth/me", headers=h).status_code == 401
    assert client.post("/auth/refresh", headers=XRW).status_code == 401
    with app.state.session_factory() as s:
        assert all(x.revoked_at is not None for x in s.scalars(select(SessionRow).where(SessionRow.user_id == "user-marina")))


def test_logout_with_cookies_only_needs_csrf_header_and_works_with_expired_access(client):
    do_login(client)
    assert client.post("/auth/logout").status_code == 403
    client.cookies.set("cl_access", "expirado-ou-lixo")
    assert client.post("/auth/logout", headers=XRW).status_code == 204  # revoga pelo refresh
    client.cookies.clear()
    assert client.post("/auth/logout").status_code == 204  # sem sessão nenhuma: idempotente


def test_logout_only_ends_the_current_session(client):
    a = do_login(client).json()["token"]
    client.cookies.clear()
    b = do_login(client).json()["token"]
    client.cookies.clear()
    client.post("/auth/logout", headers=bearer(a))
    assert client.get("/auth/me", headers=bearer(a)).status_code == 401
    assert client.get("/auth/me", headers=bearer(b)).status_code == 200


def test_demo_login_session_is_revocable_too(client):
    token = client.post("/demo/login/student").json()["token"]
    assert client.post("/auth/logout", headers=bearer(token)).status_code == 204
    assert client.get("/auth/me", headers=bearer(token)).status_code == 401


def test_session_revocation_is_per_session_not_per_user(client, app):
    first = client.post("/demo/login/student").json()["token"]
    second = client.post("/demo/login/student").json()["token"]
    assert first != second
    client.cookies.clear()  # sem cookies: o logout só encerra a sessão do Bearer enviado
    client.post("/auth/logout", headers=bearer(first))
    assert client.get("/auth/me", headers=bearer(second)).status_code == 200


def test_tokens_without_sid_from_before_sessions_still_work_until_they_expire(client, settings):
    now = datetime.now(UTC)
    legacy = jwt.encode({"sub": "user-marina", "typ": "access", "iat": now, "exp": now + timedelta(hours=1)}, settings.secret_key, algorithm="HS256")
    assert client.get("/auth/me", headers=bearer(legacy)).status_code == 200


def test_cors_allows_credentials_and_csrf_header_for_configured_origin_only(client):
    ok = client.options(
        "/auth/refresh",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "x-requested-with,content-type"},
    )
    assert ok.status_code == 200 and ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert ok.headers["access-control-allow-credentials"] == "true"
    assert "x-requested-with" in ok.headers["access-control-allow-headers"].lower()
    bad = client.options(
        "/auth/refresh",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "x-requested-with"},
    )
    assert "access-control-allow-origin" not in bad.headers
