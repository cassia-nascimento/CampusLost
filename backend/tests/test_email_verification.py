"""B1/2: verificação de e-mail, bloqueio de escrita sem verificação e anti pre-hijack."""

from __future__ import annotations

import hashlib
import re

import pytest
from sqlalchemy import select

from app import google_auth
from app.models import EmailTokenRow, UserRow
from tests.conftest import extract_token
from tests.helpers import CLAIM, PASSWORD, bearer, create_item, db_user, signup, signup_payload, signup_with_link

from tests.test_google import tokeninfo


@pytest.fixture
def fake_google(monkeypatch):
    state = {"response": tokeninfo()}
    monkeypatch.setattr(google_auth, "fetch_tokeninfo", lambda settings, credential: state["response"])
    return state


def test_signup_sends_no_email_and_issues_no_token(client, mailbox, app):
    r = client.post("/auth/signup", json=signup_payload("Ana@Exemplo.com"))
    assert r.status_code == 201 and r.json()["user"]["emailVerified"] is False
    assert mailbox.sent == []
    with app.state.session_factory() as s:
        assert s.scalars(select(EmailTokenRow)).all() == []
        assert s.scalar(select(UserRow).where(UserRow.email == "ana@exemplo.com")).email_verified_at is None


def test_resend_sends_one_email_with_link_and_stores_only_the_hash(client, mailbox, app):
    signup(client, email="Ana@Exemplo.com")
    client.post("/auth/resend-verification", json={"email": "ana@exemplo.com"})
    assert len(mailbox.sent) == 1
    mail = mailbox.sent[0]
    assert mail.to == "ana@exemplo.com"
    assert re.fullmatch(r"http://localhost:3000/verificar-email\?token=[A-Za-z0-9_\-]{40,}", mail.link)
    token = extract_token(mail)
    assert PASSWORD not in mail.text and PASSWORD not in mail.subject  # nunca a senha por e-mail
    with app.state.session_factory() as s:
        rows = s.scalars(select(EmailTokenRow)).all()
        assert len(rows) == 1 and rows[0].purpose == "verify"
        assert rows[0].token_hash == hashlib.sha256(token.encode()).hexdigest() and token not in rows[0].token_hash
        assert (rows[0].expires_at - rows[0].created_at).total_seconds() == 24 * 3600
        assert s.scalar(select(UserRow).where(UserRow.email == "ana@exemplo.com")).email_verified_at is None


def test_institutional_email_by_password_still_requires_verification(client, app):
    client.post("/auth/signup", json=signup_payload("aluno@undb.edu.br"))
    assert db_user(app, "aluno@undb.edu.br").email_verified_at is None


def test_unverified_password_account_can_register_and_claim_right_after_signup(client, mailbox, app):
    body = client.post("/auth/signup", json=signup_payload()).json()
    h = bearer(body["token"])
    assert create_item(client, h).status_code == 201
    assert client.post("/items/item-01/claims", json=CLAIM, headers=h).status_code == 201
    viewer = client.get("/items/item-02", headers=h).json()["viewer"]
    assert viewer["claim"]["allowed"] is True
    assert mailbox.sent == []
    assert db_user(app, "novo@exemplo.com").email_verified_at is None  # segue não verificada (anti pre-hijack)


def test_unverified_can_login_and_still_works(client):
    signup(client)
    login = client.post("/auth/login", json={"email": "novo@exemplo.com", "password": PASSWORD})
    assert login.status_code == 200 and login.json()["user"]["emailVerified"] is False
    h = bearer(login.json()["token"])
    assert client.get("/auth/me", headers=h).json()["emailVerified"] is False
    assert create_item(client, h).status_code == 201
    assert client.get("/items", headers=h).status_code == 200
    assert client.get("/claims/mine", headers=h).status_code == 200


def test_verify_email_marks_verified_and_is_single_use(client, mailbox):
    token_bearer = signup_with_link(client)["token"]
    token = extract_token(mailbox.sent[-1])
    ok = client.post("/auth/verify-email", json={"token": token})
    assert ok.status_code == 200 and ok.json() == {"verified": True}
    h = bearer(token_bearer)  # a sessão que já existia passa a valer para escrita
    assert client.get("/auth/me", headers=h).json()["emailVerified"] is True
    assert create_item(client, h).status_code == 201
    assert client.post("/items/item-01/claims", json=CLAIM, headers=h).status_code == 201
    again = client.post("/auth/verify-email", json={"token": token})
    assert again.status_code == 400 and again.json()["code"] == "INVALID_TOKEN"


@pytest.mark.parametrize("token", ["", "curto", "x" * 300, None, 5, "a" * 43])
def test_verify_email_rejects_garbage_tokens(client, token):
    r = client.post("/auth/verify-email", json={"token": token})
    assert r.status_code == 400 and r.json()["code"] == "INVALID_TOKEN"
    assert client.post("/auth/verify-email", json={}).status_code == 400


def test_verify_token_expires_after_24_hours(client, mailbox, clock):
    signup_with_link(client)
    token = extract_token(mailbox.sent[-1])
    clock.advance(hours=24, seconds=1)
    r = client.post("/auth/verify-email", json={"token": token})
    assert r.status_code == 400 and r.json()["code"] == "INVALID_TOKEN"


def test_verify_token_valid_just_before_24_hours(client, mailbox, clock):
    signup_with_link(client)
    token = extract_token(mailbox.sent[-1])
    clock.advance(hours=23, minutes=59)
    assert client.post("/auth/verify-email", json={"token": token}).status_code == 200


def test_reset_token_cannot_verify_email(client, mailbox):
    signup(client)
    client.post("/auth/forgot-password", json={"email": "novo@exemplo.com"})
    reset_token = extract_token(mailbox.sent[-1])
    assert client.post("/auth/verify-email", json={"token": reset_token}).status_code == 400


def test_resend_is_generic_and_only_sends_for_unverified_accounts(client, mailbox):
    signup(client)
    sent_before = len(mailbox.sent)
    unknown = client.post("/auth/resend-verification", json={"email": "ninguem@exemplo.com"})
    known = client.post("/auth/resend-verification", json={"email": "NOVO@exemplo.com"})
    assert unknown.status_code == known.status_code == 202 and unknown.json() == known.json()
    assert len(mailbox.sent) == sent_before + 1 and mailbox.sent[-1].to == "novo@exemplo.com"
    # o link novo funciona e o antigo foi invalidado
    assert client.post("/auth/verify-email", json={"token": extract_token(mailbox.sent[-1])}).status_code == 200
    # conta já verificada: resposta igual, nada enviado
    n = len(mailbox.sent)
    again = client.post("/auth/resend-verification", json={"email": "novo@exemplo.com"})
    assert again.status_code == 202 and again.json() == known.json() and len(mailbox.sent) == n


def test_resend_invalidates_the_previous_link(client, mailbox, clock):
    signup_with_link(client)
    old = extract_token(mailbox.sent[-1])
    clock.advance(hours=1)
    client.post("/auth/resend-verification", json={"email": "novo@exemplo.com"})
    assert client.post("/auth/verify-email", json={"token": old}).status_code == 400
    assert client.post("/auth/verify-email", json={"token": extract_token(mailbox.sent[-1])}).status_code == 200


def test_resend_is_limited_per_account_but_response_stays_the_same(client, mailbox):
    signup(client)  # 1º e-mail
    responses = [client.post("/auth/resend-verification", json={"email": "novo@exemplo.com"}) for _ in range(6)]
    assert {r.status_code for r in responses} == {202} and len({r.text for r in responses}) == 1
    assert len(mailbox.sent) == 3  # limite: 3 por hora por conta (silencioso)


def test_resend_is_limited_per_ip(client):
    codes = [client.post("/auth/resend-verification", json={"email": f"x{i}@exemplo.com"}).status_code for i in range(22)]
    assert codes[:20] == [202] * 20 and codes[20] == 429


def test_logged_in_resend_without_body_uses_session_email(client, mailbox):
    h = bearer(signup(client)["token"])
    n = len(mailbox.sent)
    r = client.post("/auth/resend-verification", headers=h)
    assert r.status_code == 202 and len(mailbox.sent) == n + 1 and mailbox.sent[-1].to == "novo@exemplo.com"


def test_resend_malformed_email_is_validation_error(client):
    r = client.post("/auth/resend-verification", json={"email": "sem-arroba"})
    assert r.status_code == 422


# --- anti pre-hijack -----------------------------------------------------------------------------------------------


def test_google_login_discards_unverified_password_account_of_the_same_email(client, fake_google, app):
    """Atacante cadastra por senha o e-mail institucional da vítima; a vítima entra com Google."""
    attacker = signup(client, email="ana.souza@undb.edu.br")
    attacker_login = client.post("/auth/login", json={"email": "ana.souza@undb.edu.br", "password": PASSWORD})
    assert attacker_login.status_code == 200
    r = client.post("/auth/google", json={"credential": "x"})
    assert r.status_code == 200 and r.json()["status"] == "needs_terms"  # a conta falsa não é herdada
    assert db_user(app, "ana.souza@undb.edu.br") is None
    # a senha e as sessões do atacante morreram
    assert client.post("/auth/login", json={"email": "ana.souza@undb.edu.br", "password": PASSWORD}).status_code == 401
    assert client.get("/auth/me", headers=bearer(attacker["token"])).status_code == 401
    assert client.get("/auth/me", headers=bearer(attacker_login.json()["token"])).status_code == 401
    # a vítima conclui o cadastro: conta Google verificada, sem senha
    done = client.post(
        "/auth/google/complete", json={"ticket": r.json()["ticket"], "acceptTerms": True}
    )
    assert done.status_code == 201
    row = db_user(app, "ana.souza@undb.edu.br")
    assert row.provider == "google" and row.password_hash is None and row.email_verified_at is not None


def test_google_login_discards_unverified_non_institutional_account_too(client, fake_google, app):
    fake_google["response"] = tokeninfo(email="vitima@gmail.com", name="Vítima")
    signup(client, email="vitima@gmail.com")
    r = client.post("/auth/google", json={"credential": "x"})
    assert r.json()["status"] == "needs_terms"
    done = client.post("/auth/google", json={"credential": "x", "acceptTerms": True}).json()
    assert done["status"] == "signed_in" and done["user"]["role"] == "user" and done["user"]["affiliation"] == "external"
    assert client.post("/auth/login", json={"email": "vitima@gmail.com", "password": PASSWORD}).status_code == 401


def test_google_login_keeps_verified_password_account(client, fake_google, mailbox, app):
    signup_with_link(client, email="ana.souza@undb.edu.br")
    client.post("/auth/verify-email", json={"token": extract_token(mailbox.sent[-1])})
    r = client.post("/auth/google", json={"credential": "x"}).json()
    assert r["status"] == "signed_in"
    assert client.post("/auth/login", json={"email": "ana.souza@undb.edu.br", "password": PASSWORD}).status_code == 200


def test_signup_does_not_overwrite_existing_account(client, fake_google):
    signup(client, email="dupe@exemplo.com")
    r = client.post("/auth/signup", json=signup_payload("dupe@exemplo.com"))
    assert r.status_code == 409 and r.json()["code"] == "EMAIL_TAKEN"


def test_reset_password_also_defuses_a_pre_hijack(client, mailbox):
    """A dona real do e-mail usa "esqueci a senha": a senha do atacante é trocada e as sessões dele caem."""
    attacker = signup(client, email="vitima@exemplo.com")
    client.post("/auth/forgot-password", json={"email": "vitima@exemplo.com"})
    token = extract_token(mailbox.sent[-1])
    assert client.post("/auth/reset-password", json={"token": token, "password": "Outra-senha-9!x"}).status_code == 200
    assert client.get("/auth/me", headers=bearer(attacker["token"])).status_code == 401
    assert client.post("/auth/login", json={"email": "vitima@exemplo.com", "password": PASSWORD}).status_code == 401
    ok = client.post("/auth/login", json={"email": "vitima@exemplo.com", "password": "Outra-senha-9!x"})
    assert ok.status_code == 200 and ok.json()["user"]["emailVerified"] is True
