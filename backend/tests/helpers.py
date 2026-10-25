"""Apoio dos testes de autenticação (B1)."""

from __future__ import annotations

from sqlalchemy import select

from app.models import UserRow
from tests.conftest import ITEM_FORM, extract_token

CLAIM = {"proofDetails": "Tem um adesivo azul na parte de trás.", "lostWhereWhen": "Biblioteca, ontem à tarde."}
PASSWORD = "senha-forte-1"


def signup_payload(email="novo@exemplo.com", role="student", **over):
    return {"name": "Pessoa Nova", "email": email, "password": PASSWORD, "role": role, "acceptTerms": True, **over}


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def signup(client, **kw):
    r = client.post("/auth/signup", json=signup_payload(**kw))
    assert r.status_code == 201, r.text
    client.cookies.clear()
    return r.json()


def signup_verified(client, mailbox, **kw):
    body = signup(client, **kw)
    r = client.post("/auth/verify-email", json={"token": extract_token(mailbox.sent[-1])})
    assert r.status_code == 200, r.text
    return body


def db_user(app, email: str) -> UserRow:
    with app.state.session_factory() as s:
        return s.scalar(select(UserRow).where(UserRow.email == email))


def create_item(client, headers):
    return client.post("/items", data=ITEM_FORM, headers=headers)
