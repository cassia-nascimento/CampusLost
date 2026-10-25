"""Tokens de e-mail (verificação 24 h, redefinição 1 h): aleatórios, uso único, só o hash no banco."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .config import Settings, random_id
from .models import EmailTokenRow, UserRow
from .security import hash_token, new_opaque_token

VERIFY = "verify"
RESET = "reset"


def _lifetime(settings: Settings, purpose: str) -> timedelta:
    if purpose == VERIFY:
        return timedelta(hours=settings.verify_token_hours)
    return timedelta(minutes=settings.reset_token_minutes)


def recently_issued(db: Session, settings: Settings, user: UserRow, purpose: str, now: datetime) -> bool:
    """Já houve `email_token_hourly_limit` emissões na última hora? (limite por conta, silencioso)"""
    count = db.scalar(
        select(func.count()).select_from(EmailTokenRow).where(
            EmailTokenRow.user_id == user.id,
            EmailTokenRow.purpose == purpose,
            EmailTokenRow.created_at > now - timedelta(hours=1),
        )
    )
    return (count or 0) >= settings.email_token_hourly_limit


def issue_token(db: Session, settings: Settings, user: UserRow, purpose: str, now: datetime) -> str:
    """Invalida os tokens anteriores ainda abertos da mesma finalidade, cria um novo e devolve o valor em claro
    (que só existe aqui e no e-mail). Faz commit."""
    db.execute(
        update(EmailTokenRow)
        .where(EmailTokenRow.user_id == user.id, EmailTokenRow.purpose == purpose, EmailTokenRow.used_at.is_(None))
        .values(used_at=now)
    )
    raw = new_opaque_token()
    db.add(
        EmailTokenRow(
            id=random_id("etok"), user_id=user.id, purpose=purpose, token_hash=hash_token(raw),
            created_at=now, expires_at=now + _lifetime(settings, purpose), used_at=None,
        )
    )
    db.commit()
    return raw


def find_valid(db: Session, raw: str, purpose: str, now: datetime) -> EmailTokenRow | None:
    row = db.scalar(select(EmailTokenRow).where(EmailTokenRow.token_hash == hash_token(raw)))
    if row is None or row.purpose != purpose or row.used_at is not None or row.expires_at <= now:
        return None
    return row


def consume(db: Session, row: EmailTokenRow, now: datetime) -> bool:
    """Marca como usado de forma atômica (`UPDATE ... WHERE used_at IS NULL`). `False` se alguém usou antes."""
    result = db.execute(
        update(EmailTokenRow).where(EmailTokenRow.id == row.id, EmailTokenRow.used_at.is_(None)).values(used_at=now)
    )
    return result.rowcount == 1
