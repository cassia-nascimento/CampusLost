"""Regras de 2FA (B2) compartilhadas por login, `/auth/2fa/*`: conferir TOTP/código de recuperação."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from . import totp
from .models import RecoveryCodeRow, UserRow
from .security import hash_token


def throttle_key(user: UserRow) -> str:
    """Chave do `login_throttle` para tentativas de segundo fator (separada da de senha)."""
    return f"2fa:{user.id}"


def check_totp(db: Session, user: UserRow, code: object, now: datetime) -> bool:
    """Confere e consome o passo (anti-reuso). Faz commit quando aceita."""
    if not user.totp_secret:
        return False
    step = totp.verify(user.totp_secret, code, now, user.totp_last_step)
    if step is None:
        return False
    # atômico: só um pedido consegue avançar `totp_last_step` para este passo
    result = db.execute(
        update(UserRow)
        .where(UserRow.id == user.id, (UserRow.totp_last_step.is_(None)) | (UserRow.totp_last_step < step))
        .values(totp_last_step=step)
    )
    if result.rowcount != 1:
        db.rollback()
        return False
    user.totp_last_step = step
    db.commit()
    return True


def check_recovery(db: Session, user: UserRow, code: object, now: datetime) -> bool:
    """Consome um código de recuperação (uso único, atômico). Faz commit quando aceita."""
    normalized = totp.normalize_recovery(code)
    if normalized is None:
        return False
    result = db.execute(
        update(RecoveryCodeRow)
        .where(
            RecoveryCodeRow.user_id == user.id,
            RecoveryCodeRow.code_hash == hash_token(normalized),
            RecoveryCodeRow.used_at.is_(None),
        )
        .values(used_at=now)
    )
    if result.rowcount != 1:
        db.rollback()
        return False
    db.commit()
    return True


def remaining_recovery_codes(db: Session, user: UserRow) -> int:
    rows = db.scalars(
        select(RecoveryCodeRow.id).where(RecoveryCodeRow.user_id == user.id, RecoveryCodeRow.used_at.is_(None))
    ).all()
    return len(rows)


def check_any(db: Session, user: UserRow, code: object, now: datetime) -> str | None:
    """`"totp"`, `"recovery"` ou `None`. Um código de 6 dígitos é TOTP; senão, tenta recuperação."""
    if check_totp(db, user, code, now):
        return "totp"
    if check_recovery(db, user, code, now):
        return "recovery"
    return None
