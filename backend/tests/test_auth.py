from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import select

from app.main import create_app
from app.models import UserRow
from app.security import RateLimiter, create_profile_token
from tests.conftest import DEMO_PASSWORD, Clock, FIXED_NOW, make_settings

SIGNUP = {"name": "Joana Silva", "email": "Joana@Exemplo.com", "password": "senha-forte-1", "role": "student"}
INVALID_MSG = "E-mail ou senha incorretos."


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_signup_creates_account_and_session(client):
    r = client.post("/auth/signup", json=SIGNUP)
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "joana@exemplo.com"  # normalizado
    assert body["user"]["role"] == "student"
    assert set(body["user"]) == {"id", "name", "email", "role"}
    assert body["tokenType"] == "bearer" and body["expiresAt"].endswith("Z")
    me = client.get("/auth/me", headers=bearer(body["token"]))
    assert me.status_code == 200 and me.json() == body["user"]


def test_password_hash_is_never_returned(client):
    r = client.post("/auth/signup", json=SIGNUP)
    assert "$2" not in r.text and "password" not in r.text.lower().replace("tokentype", "")
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    for path in ("/auth/me", "/items", "/items/item-01"):
        assert "$2b$" not in client.get(path, headers=h).text


def test_signup_can_log_in_with_bcrypt_password(client, app):
    client.post("/auth/signup", json=SIGNUP)
    r = client.post("/auth/login", json={"email": "joana@exemplo.com", "password": "senha-forte-1"})
    assert r.status_code == 200
    with app.state.session_factory() as s:
        row = s.scalar(select(UserRow).where(UserRow.email == "joana@exemplo.com"))
        assert row.password_hash.startswith("$2")  # bcrypt


def test_signup_duplicate_email_is_case_insensitive(client):
    assert client.post("/auth/signup", json=SIGNUP).status_code == 201
    r = client.post("/auth/signup", json={**SIGNUP, "email": "JOANA@exemplo.com", "name": "Outra Pessoa"})
    assert r.status_code == 409
    assert r.json() == {
        "code": "EMAIL_TAKEN",
        "message": "Este e-mail já está cadastrado.",
        "fieldErrors": {"email": "Este e-mail já está cadastrado."},
    }


def test_signup_cannot_create_admin_or_unknown_role(client):
    for role in ("admin", "root", None, ""):
        r = client.post("/auth/signup", json={**SIGNUP, "role": role})
        assert r.status_code == 422
        assert r.json()["fieldErrors"]["role"] == "Escolha se você é aluno ou professor."


@pytest.mark.parametrize(
    "payload, field, message",
    [
        ({"name": "A"}, "name", "Use pelo menos 2 caracteres."),
        ({"name": "  "}, "name", "Informe seu nome."),
        ({"name": "x" * 81}, "name", "Use no máximo 80 caracteres."),
        ({"email": "sem-arroba"}, "email", "Esse e-mail não parece válido. Use o formato nome@exemplo.com."),
        ({"email": ""}, "email", "Informe seu e-mail."),
        ({"password": "curta"}, "password", "Use pelo menos 8 caracteres."),
        ({"password": ""}, "password", "Crie uma senha."),
        ({"password": "x" * 73}, "password", "Use no máximo 72 caracteres."),
        ({"password": "é" * 40}, "password", "Use no máximo 72 caracteres."),  # 80 bytes: bcrypt truncaria
    ],
)
def test_signup_validation_messages(client, payload, field, message):
    r = client.post("/auth/signup", json={**SIGNUP, **payload})
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION"
    assert r.json()["fieldErrors"][field] == message


def test_signup_boundaries_ok(client):
    r = client.post("/auth/signup", json={**SIGNUP, "name": "Jo", "password": "x" * 72})
    assert r.status_code == 201
    assert client.post("/auth/signup", json={**SIGNUP, "email": "b@exemplo.com", "password": "x" * 8}).status_code == 201


def test_signup_missing_fields_and_bad_json(client):
    r = client.post("/auth/signup", json={})
    assert r.status_code == 422 and set(r.json()["fieldErrors"]) == {"name", "email", "password", "role"}
    r = client.post("/auth/signup", content=b"not json", headers={"Content-Type": "application/json"})
    assert r.status_code == 422 and r.json()["code"] == "VALIDATION"


def test_login_ok_and_same_error_for_wrong_password_and_unknown_email(client):
    ok = client.post("/auth/login", json={"email": "MARINA@demo.test", "password": DEMO_PASSWORD})
    assert ok.status_code == 200 and ok.json()["user"]["id"] == "user-marina"
    wrong = client.post("/auth/login", json={"email": "marina@demo.test", "password": "senha-errada-1"})
    unknown = client.post("/auth/login", json={"email": "ninguem@demo.test", "password": "senha-errada-1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"code": "INVALID_CREDENTIALS", "message": INVALID_MSG}


def test_login_validation_errors_are_field_errors(client):
    r = client.post("/auth/login", json={"email": "xx", "password": ""})
    assert r.status_code == 422
    assert r.json()["fieldErrors"] == {
        "email": "Esse e-mail não parece válido. Use o formato nome@exemplo.com.",
        "password": "Informe sua senha.",
    }


def test_login_long_multibyte_password_is_just_invalid_credentials(client):
    r = client.post("/auth/login", json={"email": "marina@demo.test", "password": "é" * 60})
    assert r.status_code == 401 and r.json()["code"] == "INVALID_CREDENTIALS"


def test_login_rate_limit_per_ip_and_email(client):
    bad = {"email": "marina@demo.test", "password": "senha-errada-1"}
    for _ in range(10):
        assert client.post("/auth/login", json=bad).status_code == 401
    r = client.post("/auth/login", json=bad)
    assert r.status_code == 429
    assert r.json()["code"] == "RATE_LIMITED"
    assert int(r.headers["Retry-After"]) >= 1
    # mesmo com a senha certa, continua bloqueado nessa janela
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD}).status_code == 429
    # outro e-mail não é afetado
    assert client.post("/auth/login", json={"email": "rafael@demo.test", "password": DEMO_PASSWORD}).status_code == 200


def test_rate_limiter_window_expires():
    t = [0.0]
    rl = RateLimiter(3, 60, clock=lambda: t[0])
    for _ in range(3):
        rl.hit("k")
    with pytest.raises(Exception) as exc:
        rl.hit("k")
    assert getattr(exc.value, "code", "") == "RATE_LIMITED"
    t[0] = 61.0
    rl.hit("k")  # janela passou


def test_me_requires_valid_token(client):
    r = client.get("/auth/me")
    assert r.status_code == 401 and r.json() == {"code": "UNAUTHENTICATED", "message": "Entre na sua conta para continuar."}
    r = client.get("/auth/me", headers={"Authorization": "Basic abc"})
    assert r.status_code == 401


def _token(settings, **over):
    now = datetime.now(UTC)
    claims = {"sub": "user-marina", "typ": "access", "iat": now, "exp": now + timedelta(hours=1)}
    claims.update(over)
    return jwt.encode(claims, settings.secret_key, algorithm="HS256")


def test_expired_token_rejected(client, settings):
    now = datetime.now(UTC)
    tok = _token(settings, iat=now - timedelta(hours=2), exp=now - timedelta(hours=1))
    r = client.get("/auth/me", headers=bearer(tok))
    assert r.status_code == 401 and r.json()["code"] == "UNAUTHENTICATED"
    # também nos endpoints públicos: o cliente precisa saber que a sessão caiu
    assert client.get("/items", headers=bearer(tok)).status_code == 401


def test_tampered_wrong_secret_alg_none_and_garbage_tokens_rejected(client, settings):
    good = _token(settings)
    assert client.get("/auth/me", headers=bearer(good)).status_code == 200
    forged = jwt.encode({"sub": "user-admin", "typ": "access", "exp": datetime.now(UTC) + timedelta(hours=1), "iat": datetime.now(UTC)}, "outra-chave-qualquer-com-32-caracteres!!", algorithm="HS256")
    none_alg = jwt.encode({"sub": "user-admin", "typ": "access", "exp": datetime.now(UTC) + timedelta(hours=1), "iat": datetime.now(UTC)}, None, algorithm="none")
    head, payload, sig = good.split(".")
    for tok in (forged, none_alg, f"{head}.{payload}.{sig[:-2]}xx", "lixo", "a.b.c"):
        r = client.get("/auth/me", headers=bearer(tok))
        assert r.status_code == 401, tok


def test_token_without_expiry_or_wrong_type_rejected(client, settings):
    no_exp = jwt.encode({"sub": "user-marina", "typ": "access"}, settings.secret_key, algorithm="HS256")
    assert client.get("/auth/me", headers=bearer(no_exp)).status_code == 401
    profile = create_profile_token(settings, "a@undb.edu.br", "Aluno Teste")
    assert client.get("/auth/me", headers=bearer(profile)).status_code == 401
    other = _token(settings, typ="refresh")
    assert client.get("/auth/me", headers=bearer(other)).status_code == 401


def test_token_for_deleted_user_rejected(client, app):
    token = client.post("/auth/signup", json=SIGNUP).json()["token"]
    assert client.get("/auth/me", headers=bearer(token)).status_code == 200
    client.post("/demo/reset")  # recria o seed: o usuário novo some
    assert client.get("/auth/me", headers=bearer(token)).status_code == 401


def test_token_expiry_is_configurable(tmp_path):
    s = make_settings(tmp_path, access_token_expire_minutes=1)
    with __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(create_app(s, clock=Clock(FIXED_NOW))) as c:
        body = c.post("/demo/login/student").json()
        exp = datetime.fromisoformat(body["expiresAt"].replace("Z", "+00:00"))
        assert 0 < (exp - datetime.now(UTC)).total_seconds() <= 61
