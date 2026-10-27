"""B2/3: TOTP (RFC 6238), códigos de recuperação, login em duas etapas e exigência para administração."""

from __future__ import annotations

import base64

from app import totp
from sqlalchemy import select

from app.models import RecoveryCodeRow
from tests.admin_helpers import (
    PW, audit_rows, bearer, current_code, enable_2fa, login, make_admin_with_2fa, make_user, token_of, user_row,
)
from tests.conftest import DEMO_PASSWORD


def test_rfc6238_sha1_vectors():
    secret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
    # Apêndice B da RFC 6238 (SHA-1, 8 dígitos) -> últimos 6 dígitos com DIGITS=6
    for ts, expected in ((59, "287082"), (1111111109, "081804"), (1111111111, "050471"), (1234567890, "005924"), (2000000000, "279037")):
        assert totp.hotp(secret, ts // 30) == expected


def test_verify_window_and_replay():
    secret = totp.new_secret()
    from datetime import datetime

    now = datetime(2026, 10, 22, 15, 0, 0)
    step = totp.step_at(now)
    assert totp.verify(secret, totp.hotp(secret, step), now) == step
    assert totp.verify(secret, totp.hotp(secret, step - 1), now) == step - 1  # tolerância de 1 passo
    assert totp.verify(secret, totp.hotp(secret, step + 2), now) is None
    assert totp.verify(secret, totp.hotp(secret, step), now, last_step=step) is None  # reuso
    assert totp.verify(secret, "abcdef", now) is None and totp.verify(secret, 123456, now) is None


def test_setup_returns_secret_and_otpauth_uri(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    h = token_of(client, "u@exemplo.com")
    r = client.post("/auth/2fa/setup", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert len(body["secret"]) == 32 and body["secret"].isalnum()
    assert body["otpauthUri"].startswith("otpauth://totp/CampusLost%3Au%40exemplo.com?secret=" + body["secret"])
    assert "issuer=CampusLost" in body["otpauthUri"] and "digits=6" in body["otpauthUri"] and "period=30" in body["otpauthUri"]
    assert user_row(app, "u@exemplo.com").totp_enabled_at is None  # ainda inativo
    assert client.post("/auth/2fa/setup").status_code == 401


def test_enable_requires_valid_code_and_returns_eight_recovery_codes(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    h = token_of(client, "u@exemplo.com")
    assert client.post("/auth/2fa/enable", json={"code": "123456"}, headers=h).status_code == 409  # sem setup
    secret = client.post("/auth/2fa/setup", headers=h).json()["secret"]
    bad = client.post("/auth/2fa/enable", json={"code": "000000"}, headers=h)
    assert bad.status_code == 422 and "code" in bad.json()["fieldErrors"]
    r = client.post("/auth/2fa/enable", json={"code": current_code(clock, secret)}, headers=h)
    assert r.status_code == 200
    codes = r.json()["recoveryCodes"]
    assert r.json()["enabled"] is True and len(codes) == 8 and len(set(codes)) == 8
    with app.state.session_factory() as s:
        hashes = [c.code_hash for c in s.scalars(select(RecoveryCodeRow)).all()]
    assert len(hashes) == 8 and not set(codes) & set(hashes) and all(len(x) == 64 for x in hashes)  # só hash
    assert client.post("/auth/2fa/setup", headers=h).status_code == 409  # já ativo
    assert [r.action for r in audit_rows(app, "2fa.enable")] == ["2fa.enable"]


def test_login_with_2fa_needs_challenge_then_totp(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    h = token_of(client, "u@exemplo.com")
    secret, _ = enable_2fa(client, clock, h)
    r = login(client, "u@exemplo.com")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "needs_2fa" and set(body) == {"status", "challengeToken"}
    assert "set-cookie" not in r.headers  # sem sessão antes do segundo fator
    ch = body["challengeToken"]
    assert client.get("/auth/me", headers=bearer(ch)).status_code == 401  # desafio não é token de sessão
    bad = client.post("/auth/2fa/verify", json={"challengeToken": ch, "code": "000000"})
    assert bad.status_code == 401 and bad.json()["code"] == "INVALID_CREDENTIALS"
    ok = client.post("/auth/2fa/verify", json={"challengeToken": ch, "code": current_code(clock, secret)})
    assert ok.status_code == 200 and ok.json()["user"]["email"] == "u@exemplo.com"
    assert client.get("/auth/me", headers=bearer(ok.json()["token"])).status_code == 200
    # o mesmo código não vale duas vezes
    again = client.post("/auth/2fa/verify", json={"challengeToken": ch, "code": current_code(clock, secret)})
    assert again.status_code == 401


def test_verify_with_recovery_code_is_single_use(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    h = token_of(client, "u@exemplo.com")
    _, codes = enable_2fa(client, clock, h)
    ch = login(client, "u@exemplo.com").json()["challengeToken"]
    ok = client.post("/auth/2fa/verify", json={"challengeToken": ch, "recoveryCode": codes[0].upper()})
    assert ok.status_code == 200
    ch2 = login(client, "u@exemplo.com").json()["challengeToken"]
    reused = client.post("/auth/2fa/verify", json={"challengeToken": ch2, "recoveryCode": codes[0]})
    assert reused.status_code == 401
    other = client.post("/auth/2fa/verify", json={"challengeToken": ch2, "recoveryCode": codes[1]})
    assert other.status_code == 200


def test_verify_rejects_garbage_and_foreign_tokens(client, app, clock):
    assert client.post("/auth/2fa/verify", json={"challengeToken": "x.y.z", "code": "123456"}).status_code == 401
    assert client.post("/auth/2fa/verify", json={"code": "123456"}).status_code == 401
    r = client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD})
    assert client.post("/auth/2fa/verify", json={"challengeToken": r.json()["token"], "code": "123456"}).status_code == 401


def test_verify_is_throttled(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    h = token_of(client, "u@exemplo.com")
    secret, _ = enable_2fa(client, clock, h)
    ch = login(client, "u@exemplo.com").json()["challengeToken"]
    for _ in range(10):
        assert client.post("/auth/2fa/verify", json={"challengeToken": ch, "code": "000000"}).status_code == 401
    r = client.post("/auth/2fa/verify", json={"challengeToken": ch, "code": current_code(clock, secret)})
    assert r.status_code == 429 and "Retry-After" in r.headers  # nem o código certo passa durante o bloqueio


def test_disable_needs_password_and_code(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    h = token_of(client, "u@exemplo.com")
    secret, _ = enable_2fa(client, clock, h)
    wrong_pw = client.post("/auth/2fa/disable", json={"password": "errada-errada", "code": current_code(clock, secret)}, headers=h)
    assert wrong_pw.status_code == 403
    wrong_code = client.post("/auth/2fa/disable", json={"password": PW, "code": "000000"}, headers=h)
    assert wrong_code.status_code == 403
    assert user_row(app, "u@exemplo.com").totp_enabled_at is not None
    ok = client.post("/auth/2fa/disable", json={"password": PW, "code": current_code(clock, secret)}, headers=h)
    assert ok.status_code == 200 and ok.json() == {"enabled": False}
    row = user_row(app, "u@exemplo.com")
    assert row.totp_secret is None and row.totp_enabled_at is None
    with app.state.session_factory() as s:
        assert s.scalars(select(RecoveryCodeRow)).all() == []
    assert login(client, "u@exemplo.com").json().get("status") is None  # volta ao login simples
    assert [r.action for r in audit_rows(app, "2fa.disable")] == ["2fa.disable"]
    assert client.post("/auth/2fa/disable", json={"password": PW, "code": "123456"}, headers=h).status_code == 409


def test_admin_without_2fa_logs_in_but_gets_403_on_admin_routes(strict_client, strict_app, clock):
    make_user(strict_app, "chefe@exemplo.com")
    h = token_of(strict_client, "chefe@exemplo.com")
    for method, path in (("get", "/admin/users"), ("get", "/admin/audit"), ("get", "/admin/invites")):
        r = getattr(strict_client, method)(path, headers=h)
        assert r.status_code == 403 and r.json()["code"] == "TWO_FACTOR_REQUIRED", path
    assert strict_client.post("/auth/2fa/setup", headers=h).status_code == 200  # setup liberado
    secret = user_row(strict_app, "chefe@exemplo.com").totp_secret
    strict_client.post("/auth/2fa/enable", json={"code": current_code(clock, secret)}, headers=h)
    assert strict_client.get("/admin/users", headers=h).status_code == 200


def test_admin_login_with_2fa_reaches_admin_routes(strict_client, strict_app, clock):
    headers, secret, _ = make_admin_with_2fa(strict_client, strict_app, clock)
    ch = login(strict_client, "chefe@exemplo.com").json()["challengeToken"]
    r = strict_client.post("/auth/2fa/verify", json={"challengeToken": ch, "code": current_code(clock, secret)})
    assert strict_client.get("/admin/users", headers=bearer(r.json()["token"])).status_code == 200


def test_demo_admin_and_demo_mode_are_exempt(client, strict_client, admin):
    assert client.get("/admin/users", headers=admin).status_code == 200  # demo_mode: flag automática desligada
    r = strict_client.post("/demo/login/admin")  # flag ligada, mas o admin do seed demo é isento
    assert strict_client.get("/admin/users", headers=bearer(r.json()["token"])).status_code == 200


def test_non_admin_gets_403_forbidden_on_admin_routes(client, student):
    r = client.get("/admin/users", headers=student)
    assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN"
    assert client.get("/admin/users").status_code == 401


def test_google_login_of_a_2fa_user_also_asks_for_the_second_factor(client, app, clock, monkeypatch):
    make_user(app, "u@undb.edu.br", role="user")
    h = token_of(client, "u@undb.edu.br")
    enable_2fa(client, clock, h)
    import app.routers.auth as auth_router

    monkeypatch.setattr(auth_router, "verify_google_credential", lambda s, c: {"email": "u@undb.edu.br", "name": "U"})
    r = client.post("/auth/google", json={"credential": "x" * 20})
    assert r.status_code == 200 and r.json()["status"] == "needs_2fa" and "token" not in r.json()


def test_account_json_exposes_two_factor_enabled(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    r = login(client, "u@exemplo.com")
    h = bearer(r.json()["token"])
    client.cookies.clear()
    assert r.json()["user"]["twoFactorEnabled"] is False
    assert client.get("/auth/me", headers=h).json()["twoFactorEnabled"] is False
    secret, _ = enable_2fa(client, clock, h)
    assert client.get("/auth/me", headers=h).json()["twoFactorEnabled"] is True
    ch = login(client, "u@exemplo.com").json()["challengeToken"]
    v = client.post("/auth/2fa/verify", json={"challengeToken": ch, "code": current_code(clock, secret)})
    assert v.json()["user"]["twoFactorEnabled"] is True
    s = client.post("/auth/signup", json={"name": "Pessoa Nova", "email": "n@exemplo.com", "password": PW, "role": "student", "acceptTerms": True})
    assert s.json()["user"]["twoFactorEnabled"] is False


LEGACY_ADMIN_ROUTES = (
    ("post", "/claims/claim-01/accept"),
    ("post", "/claims/claim-01/reject"),
    ("get", "/claims/pending"),
    ("get", "/items/item-01/claims"),
    ("post", "/items/item-01/return"),
    ("get", "/returns"),
    ("delete", "/items/item-01"),
)


def test_legacy_admin_routes_require_2fa_too(strict_client, strict_app, clock):
    make_user(strict_app, "chefe@exemplo.com")
    h = token_of(strict_client, "chefe@exemplo.com")
    for method, path in LEGACY_ADMIN_ROUTES:
        r = getattr(strict_client, method)(path, headers=h)
        assert r.status_code == 403 and r.json()["code"] == "TWO_FACTOR_REQUIRED", path
    put = strict_client.put("/items/item-01", data={"title": "Novo título"}, headers=h)
    assert put.status_code == 403 and put.json()["code"] == "TWO_FACTOR_REQUIRED"
    enable_2fa(strict_client, clock, h)
    assert strict_client.get("/claims/pending", headers=h).status_code == 200
    assert strict_client.get("/returns", headers=h).status_code == 200
    # rotas que admin usa como qualquer papel não são bloqueadas
    assert strict_client.get("/items", headers=h).status_code == 200


def test_legacy_admin_routes_keep_forbidden_for_other_roles_and_demo_exemption(strict_client, client, student, admin):
    for method, path in LEGACY_ADMIN_ROUTES[:2] + LEGACY_ADMIN_ROUTES[5:6]:
        assert getattr(client, method)(path, headers=student).status_code == 403
        assert getattr(client, method)(path, headers=student).json()["code"] == "FORBIDDEN"
    assert client.get("/returns", headers=admin).status_code == 200  # demo: isento
    r = strict_client.post("/demo/login/admin")
    assert strict_client.get("/returns", headers=bearer(r.json()["token"])).status_code == 200  # user-admin isento


def test_create_admin_cli_sets_role_and_affiliation(tmp_path, monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app import create_admin
    from app.models import UserRow

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'ca.db'}")
    monkeypatch.setenv("SECRET_KEY", "x" * 40)
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("ADMIN_PASSWORD", "senha-forte-1")
    monkeypatch.setenv("BCRYPT_ROUNDS", "4")
    assert create_admin.main(["--email", "adm@undb.edu.br", "--name", "Adm Teste"]) == 0
    assert create_admin.main(["--email", "adm2@gmail.com", "--name", "Adm Dois"]) == 0
    with Session(create_engine(f"sqlite:///{tmp_path / 'ca.db'}")) as s:
        rows = {u.email: (u.role, u.affiliation) for u in s.scalars(select(UserRow))}
    assert rows == {"adm@undb.edu.br": ("admin", "institutional"), "adm2@gmail.com": ("admin", "external")}
