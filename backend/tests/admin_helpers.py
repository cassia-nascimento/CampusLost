"""Apoio dos testes de administração, auditoria e 2FA (B2)."""

from __future__ import annotations

from sqlalchemy import select

from app import totp
from app.config import random_id
from app.models import AuditLogRow, UserRow
from app.security import hash_password
from tests.conftest import FIXED_NOW

PW = "senha-forte-1"


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def make_user(app, email: str, role: str = "admin", name: str = "Pessoa Teste", verified: bool = True) -> UserRow:
    with app.state.session_factory() as s:
        u = UserRow(
            id=random_id("user"), name=name, email=email, role=role, provider="password",
            password_hash=hash_password(PW, 4), created_at=FIXED_NOW, email_verified_at=FIXED_NOW if verified else None,
        )
        s.add(u)
        s.commit()
        return u


def login(client, email: str, password: str = PW):
    return client.post("/auth/login", json={"email": email, "password": password})


def token_of(client, email: str) -> dict[str, str]:
    r = login(client, email)
    assert r.status_code == 200, r.text
    client.cookies.clear()
    return bearer(r.json()["token"])


def current_code(clock, secret: str, offset: int = 0) -> str:
    return totp.hotp(secret, totp.step_at(clock.t) + offset)


def enable_2fa(client, clock, headers) -> tuple[str, list[str]]:
    """Liga o 2FA da conta; devolve (segredo, códigos de recuperação). Avança o relógio 30 s (anti-reuso)."""
    secret = client.post("/auth/2fa/setup", headers=headers).json()["secret"]
    r = client.post("/auth/2fa/enable", json={"code": current_code(clock, secret)}, headers=headers)
    assert r.status_code == 200, r.text
    clock.advance(seconds=30)
    return secret, r.json()["recoveryCodes"]


def make_admin_with_2fa(client, app, clock, email="chefe@exemplo.com"):
    make_user(app, email)
    headers = token_of(client, email)
    secret, codes = enable_2fa(client, clock, headers)
    return headers, secret, codes


def audit_rows(app, action: str | None = None) -> list[AuditLogRow]:
    with app.state.session_factory() as s:
        q = select(AuditLogRow).order_by(AuditLogRow.id)
        if action:
            q = q.where(AuditLogRow.action == action)
        return list(s.scalars(q).all())


def user_row(app, email: str) -> UserRow:
    with app.state.session_factory() as s:
        return s.scalar(select(UserRow).where(UserRow.email == email))
