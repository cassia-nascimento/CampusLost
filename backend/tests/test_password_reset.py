"""B1/4: recuperação de senha."""

from __future__ import annotations

import hashlib

from sqlalchemy import select

from app.models import EmailTokenRow, SessionRow
from tests.conftest import DEMO_PASSWORD, extract_token
from tests.helpers import PASSWORD, bearer, signup

NEW = "Nova-senha-forte-42"


def forgot(client, email):
    return client.post("/auth/forgot-password", json={"email": email})


def test_forgot_is_always_202_with_identical_body_and_only_mails_real_accounts(client, mailbox):
    known = forgot(client, "marina@demo.test")
    unknown = forgot(client, "ninguem@exemplo.com")
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()
    assert [m.to for m in mailbox.sent] == ["marina@demo.test"]
    assert "/redefinir-senha?token=" in mailbox.sent[0].link


def test_forgot_validates_email_shape_only(client):
    assert forgot(client, "sem-arroba").status_code == 422
    assert client.post("/auth/forgot-password", json={}).status_code == 422


def test_reset_token_is_stored_hashed_with_one_hour_expiry(client, mailbox, app):
    forgot(client, "marina@demo.test")
    token = extract_token(mailbox.sent[-1])
    with app.state.session_factory() as s:
        row = s.scalar(select(EmailTokenRow).where(EmailTokenRow.purpose == "reset"))
        assert row.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert token not in row.token_hash and (row.expires_at - row.created_at).total_seconds() == 3600


def test_reset_changes_password_and_token_is_single_use(client, mailbox):
    forgot(client, "marina@demo.test")
    token = extract_token(mailbox.sent[-1])
    r = client.post("/auth/reset-password", json={"token": token, "password": NEW})
    assert r.status_code == 200
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD}).status_code == 401
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": NEW}).status_code == 200
    again = client.post("/auth/reset-password", json={"token": token, "password": "Outra-senha-forte-43"})
    assert again.status_code == 400 and again.json()["code"] == "INVALID_TOKEN"


def test_reset_invalidates_old_bearer_and_cookie_sessions(client, mailbox):
    old = client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD})
    old_bearer = bearer(old.json()["token"])
    assert client.get("/auth/me", headers=old_bearer).status_code == 200
    forgot(client, "marina@demo.test")
    client.post("/auth/reset-password", json={"token": extract_token(mailbox.sent[-1]), "password": NEW})
    assert client.get("/auth/me", headers=old_bearer).status_code == 401
    # os cookies que o navegador ainda tem também morreram (acesso e refresh)
    assert client.get("/auth/me").status_code == 401
    assert client.post("/auth/refresh", headers={"X-Requested-With": "t"}).status_code == 401
    # sessão nova funciona
    fresh = client.post("/auth/login", json={"email": "marina@demo.test", "password": NEW}).json()
    assert client.get("/auth/me", headers=bearer(fresh["token"])).status_code == 200


def test_reset_other_users_sessions_are_untouched(client, mailbox):
    rafael = bearer(client.post("/auth/login", json={"email": "rafael@demo.test", "password": DEMO_PASSWORD}).json()["token"])
    forgot(client, "marina@demo.test")
    client.post("/auth/reset-password", json={"token": extract_token(mailbox.sent[-1]), "password": NEW})
    assert client.get("/auth/me", headers=rafael).status_code == 200


def test_reset_token_expires_after_one_hour(client, mailbox, clock):
    forgot(client, "marina@demo.test")
    token = extract_token(mailbox.sent[-1])
    clock.advance(minutes=60, seconds=1)
    r = client.post("/auth/reset-password", json={"token": token, "password": NEW})
    assert r.status_code == 400 and r.json()["code"] == "INVALID_TOKEN"
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD}).status_code == 200


def test_reset_with_weak_password_does_not_burn_the_token(client, mailbox):
    forgot(client, "marina@demo.test")
    token = extract_token(mailbox.sent[-1])
    for bad in ("curta", "Password1234", "marina@demo.test", "é" * 40):
        r = client.post("/auth/reset-password", json={"token": token, "password": bad})
        assert r.status_code == 422 and r.json()["fieldErrors"]["password"], bad
    assert client.post("/auth/reset-password", json={"token": token, "password": NEW}).status_code == 200


def test_reset_rejects_bad_tokens(client):
    for token in (None, "", "curto", "z" * 43, 5):
        r = client.post("/auth/reset-password", json={"token": token, "password": NEW})
        assert r.status_code == 400 and r.json()["code"] == "INVALID_TOKEN"


def test_new_request_invalidates_the_previous_link(client, mailbox):
    forgot(client, "marina@demo.test")
    first = extract_token(mailbox.sent[-1])
    forgot(client, "marina@demo.test")
    second = extract_token(mailbox.sent[-1])
    assert client.post("/auth/reset-password", json={"token": first, "password": NEW}).status_code == 400
    assert client.post("/auth/reset-password", json={"token": second, "password": NEW}).status_code == 200


def test_forgot_is_limited_per_account_silently(client, mailbox):
    results = [forgot(client, "marina@demo.test") for _ in range(6)]
    assert {r.status_code for r in results} == {202} and len({r.text for r in results}) == 1
    assert len(mailbox.sent) == 3


def test_verification_token_cannot_reset_password(client, mailbox):
    signup(client)
    client.post("/auth/resend-verification", json={"email": "novo@exemplo.com"})
    verify_token = extract_token(mailbox.sent[-1])
    r = client.post("/auth/reset-password", json={"token": verify_token, "password": NEW})
    assert r.status_code == 400


def test_reset_verifies_email_and_clears_login_lock(client, mailbox, app):
    signup(client)
    for _ in range(10):
        client.post("/auth/login", json={"email": "novo@exemplo.com", "password": "errada-errada-1"})
    assert client.post("/auth/login", json={"email": "novo@exemplo.com", "password": PASSWORD}).status_code == 429
    forgot(client, "novo@exemplo.com")
    client.post("/auth/reset-password", json={"token": extract_token(mailbox.sent[-1]), "password": NEW})
    r = client.post("/auth/login", json={"email": "novo@exemplo.com", "password": NEW})
    assert r.status_code == 200 and r.json()["user"]["emailVerified"] is True


def test_reset_revokes_session_rows(client, mailbox, app):
    client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD})
    forgot(client, "marina@demo.test")
    client.post("/auth/reset-password", json={"token": extract_token(mailbox.sent[-1]), "password": NEW})
    with app.state.session_factory() as s:
        rows = s.scalars(select(SessionRow).where(SessionRow.user_id == "user-marina")).all()
        assert rows and all(r.revoked_at is not None for r in rows)
