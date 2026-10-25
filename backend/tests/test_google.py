from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import select

from app import google_auth
from app.errors import ServiceError
from app.models import UserRow
from app.rules.google import is_allowed_google_email, parse_allowed_domains
from app.security import create_profile_token
from tests.conftest import extract_token

CLIENT_ID = "test-client-id.apps.googleusercontent.com"


def tokeninfo(**over):
    base = {
        "aud": CLIENT_ID,
        "iss": "https://accounts.google.com",
        "exp": str(int(time.time()) + 3600),
        "email": "ana.souza@undb.edu.br",
        "email_verified": "true",
        "name": "Ana Souza",
    }
    base.update(over)
    return {k: v for k, v in base.items() if v is not None}


@pytest.fixture
def fake_google(monkeypatch):
    """Simula a resposta do endpoint tokeninfo do Google (nenhuma chamada de rede)."""
    state = {"response": tokeninfo(), "calls": []}

    def fake(settings, credential):
        state["calls"].append(credential)
        return state["response"]

    monkeypatch.setattr(google_auth, "fetch_tokeninfo", fake)
    return state


def post(client, cred="id-token"):
    return client.post("/auth/google", json={"credential": cred})


def test_new_account_needs_role_then_complete(client, fake_google, app):
    r = post(client)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "needs_role"
    assert body["profile"] == {"email": "ana.souza@undb.edu.br", "name": "Ana Souza"}
    assert "token" not in body
    with app.state.session_factory() as s:  # nada foi criado ainda
        assert s.scalar(select(UserRow).where(UserRow.email == "ana.souza@undb.edu.br")) is None
    done = client.post("/auth/google/complete", json={"profileToken": body["profileToken"], "role": "teacher", "acceptTerms": True})
    assert done.status_code == 201
    assert done.json()["user"]["role"] == "teacher" and done.json()["user"]["email"] == "ana.souza@undb.edu.br"
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {done.json()['token']}"})
    assert me.status_code == 200
    with app.state.session_factory() as s:
        row = s.scalar(select(UserRow).where(UserRow.email == "ana.souza@undb.edu.br"))
        assert row.password_hash is None and row.provider == "google"
        assert row.email_verified_at is not None and row.terms_accepted_at is not None  # Google nasce verificada
    # a conta Google não tem senha: login por senha dá o erro único
    bad = client.post("/auth/login", json={"email": "ana.souza@undb.edu.br", "password": "qualquer-coisa-1"})
    assert bad.status_code == 401 and bad.json()["code"] == "INVALID_CREDENTIALS"


def test_existing_verified_account_signs_in_directly(client, fake_google, mailbox):
    client.post("/auth/signup", json={"name": "Ana Souza", "email": "ana.souza@undb.edu.br", "password": "senha-forte-1", "role": "student", "acceptTerms": True})
    assert client.post("/auth/verify-email", json={"token": extract_token(mailbox.sent[-1])}).status_code == 200
    r = post(client)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "signed_in" and body["user"]["role"] == "student" and body["token"]


def test_second_complete_is_email_taken(client, fake_google):
    ptoken = post(client).json()["profileToken"]
    assert client.post("/auth/google/complete", json={"profileToken": ptoken, "role": "student", "acceptTerms": True}).status_code == 201
    r = client.post("/auth/google/complete", json={"profileToken": ptoken, "role": "student", "acceptTerms": True})
    assert r.status_code == 409 and r.json()["code"] == "EMAIL_TAKEN"


@pytest.mark.parametrize(
    "email",
    ["aluno@gmail.com", "aluno@evilundb.edu.br", "aluno@undb.edu.br.evil.com", "aluno@undb.edu.brx.com", "aluno@edu.br"],
)
def test_non_institutional_google_email_is_external_not_student(client, fake_google, email, app):
    """Domínio parecido com o institucional NÃO vira aluno/professor: vira comunidade externa (e só com aceite)."""
    fake_google["response"] = tokeninfo(email=email)
    first = post(client).json()
    assert first["status"] == "needs_terms" and first["profile"]["email"] == email and "token" not in first
    with app.state.session_factory() as s:
        assert s.scalar(select(UserRow).where(UserRow.email == email)) is None  # nada criado sem aceite
    r = client.post("/auth/google", json={"credential": "x", "acceptTerms": True})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "signed_in" and body["user"]["role"] == "external" and body["user"]["emailVerified"] is True
    again = post(client).json()  # segunda vez: conta existe, entra direto
    assert again["status"] == "signed_in" and again["user"]["id"] == body["user"]["id"]


@pytest.mark.parametrize("email", ["aluno@evil.com@undb.edu.br", "aluno@@undb.edu.br", "aluno@undb.edu.br.", "aluno@-undb.edu.br", "undb.edu.br"])
def test_malformed_google_email_refused(client, fake_google, email):
    fake_google["response"] = tokeninfo(email=email)
    r = post(client)
    assert r.status_code == 401 and r.json()["code"] == "UNAUTHENTICATED"


@pytest.mark.parametrize("email", ["a@undb.edu.br", "A@UNDB.EDU.BR", "aluno@alunos.undb.edu.br", "x@a.b.undb.edu.br"])
def test_exact_domain_and_subdomains_accepted(client, fake_google, email):
    fake_google["response"] = tokeninfo(email=email)
    assert post(client).json()["status"] == "needs_role"


def test_domain_rule_unit_and_config_parsing():
    allowed = ("undb.edu.br",)
    assert is_allowed_google_email("a@undb.edu.br", allowed)
    assert not is_allowed_google_email("a@evilundb.edu.br", allowed)
    assert not is_allowed_google_email("a@undb.edu.br.evil.com", allowed)
    assert not is_allowed_google_email(None, allowed)
    assert parse_allowed_domains(" Outro.edu.br, undb.edu.br ,@x.org, lixo") == ("outro.edu.br", "undb.edu.br", "x.org")
    assert parse_allowed_domains("") == ("undb.edu.br",)


def test_custom_allowed_domains(tmp_path, clock, fake_google):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from tests.conftest import make_settings

    s = make_settings(tmp_path, google_allowed_domains=("outra.edu.br",))
    with TestClient(create_app(s, clock=clock)) as c:
        assert post(c).json()["status"] == "needs_terms"  # undb não está mais na lista: vira externo, não aluno
        fake_google["response"] = tokeninfo(email="x@outra.edu.br")
        assert post(c).json()["status"] == "needs_role"


@pytest.mark.parametrize(
    "over",
    [
        {"aud": "outro-client-id"},
        {"aud": None},
        {"iss": "https://evil.example.com"},
        {"iss": None},
        {"exp": str(int(time.time()) - 10)},
        {"exp": "abc"},
        {"exp": None},
        {"email_verified": "false"},
        {"email_verified": None},
        {"email": None},
        {"email": ""},
    ],
)
def test_invalid_tokeninfo_claims_refused(client, fake_google, over):
    fake_google["response"] = tokeninfo(**over)
    r = post(client)
    assert r.status_code == 401 and r.json()["code"] == "UNAUTHENTICATED"


def test_accepts_both_issuer_forms_and_boolean_verified(client, fake_google):
    fake_google["response"] = tokeninfo(iss="accounts.google.com", email_verified=True)
    assert post(client).status_code == 200


def test_google_rejects_token(client, fake_google):
    fake_google["response"] = None
    assert post(client).status_code == 401


def test_google_unreachable_is_502_without_details(client, monkeypatch):
    def boom(settings, credential):
        raise ServiceError("UNEXPECTED", "Não foi possível falar com o Google agora. Tente novamente.", status_code=502)

    monkeypatch.setattr(google_auth, "fetch_tokeninfo", boom)
    r = post(client)
    assert r.status_code == 502 and r.json()["code"] == "UNEXPECTED"


def test_google_not_configured(tmp_path, clock):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from tests.conftest import make_settings

    with TestClient(create_app(make_settings(tmp_path, google_client_id=""), clock=clock)) as c:
        r = post(c)
        assert r.status_code == 503 and r.json()["code"] == "UNEXPECTED"


def test_missing_or_bad_credential_is_validation(client, fake_google):
    for body in ({}, {"credential": ""}, {"credential": 5}, {"credential": "x" * 9000}):
        r = client.post("/auth/google", json=body)
        assert r.status_code == 422 and r.json()["fieldErrors"]["credential"]
    assert fake_google["calls"] == []


def test_complete_requires_valid_profile_token(client, fake_google, settings):
    payload = {"role": "student", "acceptTerms": True}
    assert client.post("/auth/google/complete", json=payload).status_code == 401
    assert client.post("/auth/google/complete", json={**payload, "profileToken": "lixo"}).status_code == 401
    good = create_profile_token(settings, "ana@undb.edu.br", "Ana Souza")
    head, body, sig = good.split(".")
    assert client.post("/auth/google/complete", json={**payload, "profileToken": f"{head}.{body}.{sig[:-3]}abc"}).status_code == 401
    # assinado com outra chave
    forged = jwt.encode({"typ": "google_profile", "email": "ana@undb.edu.br", "name": "Ana", "iat": datetime.now(UTC), "exp": datetime.now(UTC) + timedelta(minutes=5)}, "outra-chave-qualquer-com-32-caracteres!!", algorithm="HS256")
    assert client.post("/auth/google/complete", json={**payload, "profileToken": forged}).status_code == 401
    # expirado
    expired = jwt.encode({"typ": "google_profile", "email": "ana@undb.edu.br", "name": "Ana", "iat": datetime.now(UTC) - timedelta(hours=1), "exp": datetime.now(UTC) - timedelta(minutes=1)}, settings.secret_key, algorithm="HS256")
    assert client.post("/auth/google/complete", json={**payload, "profileToken": expired}).status_code == 401
    # token de sessão não vale como profileToken
    session = client.post("/demo/login/student").json()["token"]
    assert client.post("/auth/google/complete", json={**payload, "profileToken": session}).status_code == 401
    # e nada foi criado
    assert client.post("/auth/google/complete", json={**payload, "profileToken": good}).status_code == 201


def test_profile_token_lasts_ten_minutes(settings):
    tok = create_profile_token(settings, "a@undb.edu.br", "Ana")
    claims = jwt.decode(tok, settings.secret_key, algorithms=["HS256"])
    assert claims["exp"] - claims["iat"] == 600


def test_complete_validates_role_and_domain(client, fake_google, settings):
    ptoken = post(client).json()["profileToken"]
    for role in ("admin", "", None, "visitante"):
        r = client.post("/auth/google/complete", json={"profileToken": ptoken, "role": role, "acceptTerms": True})
        assert r.status_code == 422 and r.json()["fieldErrors"]["role"] == "Escolha se você é aluno ou professor."
    # "external" não é escolha do fluxo institucional; e sem aceite dos termos não cria conta
    r = client.post("/auth/google/complete", json={"profileToken": ptoken, "role": "external", "acceptTerms": True})
    assert r.status_code == 422 and "role" in r.json()["fieldErrors"]
    r = client.post("/auth/google/complete", json={"profileToken": ptoken, "role": "student"})
    assert r.status_code == 422 and "acceptTerms" in r.json()["fieldErrors"]
    # e-mail fora do domínio: o papel é sempre `external`, qualquer que seja o enviado
    outside = create_profile_token(settings, "x@gmail.com", "Fulano")
    r = client.post("/auth/google/complete", json={"profileToken": outside, "role": "teacher", "acceptTerms": True})
    assert r.status_code == 201 and r.json()["user"]["role"] == "external"


def test_google_name_fallback_to_email_local_part(client, fake_google):
    fake_google["response"] = tokeninfo(name=None, email="Bia.Lima@undb.edu.br")
    assert post(client).json()["profile"] == {"email": "bia.lima@undb.edu.br", "name": "bia.lima"}
    fake_google["response"] = tokeninfo(name="x" * 200)
    assert len(post(client).json()["profile"]["name"]) == 80
