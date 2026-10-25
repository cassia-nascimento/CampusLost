"""Sessões (B1/6): linha em `sessions` + token de acesso (Bearer e cookie) + refresh rotativo só por cookie.

Dois jeitos de autenticar, ambos amarrados à mesma linha de `sessions` (então `logout` revoga os dois):
- Bearer (cliente atual): JWT de `ACCESS_TOKEN_EXPIRE_MINUTES` no corpo da resposta, enviado em `Authorization`.
- Cookies HttpOnly `cl_access` (15 min, `Path=/`) e `cl_refresh` (7 dias, `Path=/auth`), SameSite=Lax,
  Secure fora de dev. O refresh é opaco, rotativo (um uso) e só o hash SHA-256 fica no banco.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .clock import to_iso
from .config import Settings, random_id
from .errors import ServiceError
from .models import SessionRow, UserRow
from .schemas import account_json
from .security import create_access_token, hash_token, new_opaque_token

ACCESS_COOKIE = "cl_access"
REFRESH_COOKIE = "cl_refresh"
REFRESH_COOKIE_PATH = "/auth"
REUSE_GRACE = timedelta(seconds=10)  # duas abas renovando juntas não contam como roubo
SESSION_EXPIRED = "Sua sessão expirou. Entre novamente."


def create_session(db: Session, settings: Settings, user: UserRow, now: datetime) -> tuple[SessionRow, str]:
    raw = new_opaque_token()
    sess = SessionRow(
        id=random_id("sess"), user_id=user.id, refresh_hash=hash_token(raw), prev_refresh_hash=None,
        created_at=now, expires_at=now + timedelta(days=settings.refresh_days),
    )
    db.add(sess)
    db.commit()
    return sess, raw


def set_auth_cookies(
    response: Response, settings: Settings, user: UserRow, sess: SessionRow, refresh_raw: str
) -> None:
    access, _ = create_access_token(
        settings, user.id, sid=sess.id, token_version=user.token_version, minutes=settings.cookie_access_minutes
    )
    common = dict(httponly=True, secure=settings.use_secure_cookies, samesite="lax")
    response.set_cookie(ACCESS_COOKIE, access, max_age=settings.cookie_access_minutes * 60, path="/", **common)
    response.set_cookie(
        REFRESH_COOKIE, refresh_raw, max_age=settings.refresh_days * 86400, path=REFRESH_COOKIE_PATH, **common
    )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    common = dict(httponly=True, secure=settings.use_secure_cookies, samesite="lax")
    response.delete_cookie(ACCESS_COOKIE, path="/", **common)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, **common)


def issue_session(
    db: Session, settings: Settings, user: UserRow, now: datetime, response: Response
) -> dict[str, Any]:
    """Cria a sessão, define os cookies e devolve o JSON de `Session` (com o token Bearer)."""
    sess, refresh_raw = create_session(db, settings, user, now)
    set_auth_cookies(response, settings, user, sess, refresh_raw)
    return session_body(settings, user, sess)


def session_body(settings: Settings, user: UserRow, sess: SessionRow) -> dict[str, Any]:
    token, exp = create_access_token(settings, user.id, sid=sess.id, token_version=user.token_version)
    return {
        "token": token,
        "tokenType": "bearer",
        "expiresAt": to_iso(exp.replace(tzinfo=None)),
        "user": account_json(user),
    }


def rotate_refresh(
    db: Session, settings: Settings, raw: str, now: datetime
) -> tuple[SessionRow, UserRow, str]:
    """Troca o refresh por um novo (o antigo morre). Reuso do antigo fora da tolerância revoga a sessão."""
    h = hash_token(raw)
    sess = db.scalar(select(SessionRow).where(SessionRow.refresh_hash == h))
    if sess is None:
        replayed = db.scalar(select(SessionRow).where(SessionRow.prev_refresh_hash == h))
        if replayed is not None and replayed.revoked_at is None:
            if replayed.rotated_at is None or now - replayed.rotated_at > REUSE_GRACE:
                replayed.revoked_at = now  # token antigo reapresentado: possível roubo
                db.commit()
        raise ServiceError("UNAUTHENTICATED", SESSION_EXPIRED)
    user = db.get(UserRow, sess.user_id)
    if sess.revoked_at is not None or sess.expires_at <= now or user is None or user.deleted_at is not None:
        raise ServiceError("UNAUTHENTICATED", SESSION_EXPIRED)
    new_raw = new_opaque_token()
    sess.prev_refresh_hash, sess.refresh_hash = h, hash_token(new_raw)
    sess.rotated_at = now
    sess.expires_at = now + timedelta(days=settings.refresh_days)
    db.commit()
    return sess, user, new_raw


def revoke_session(db: Session, sess: SessionRow, now: datetime) -> None:
    if sess.revoked_at is None:
        sess.revoked_at = now
        db.commit()


def revoke_all_sessions(db: Session, user_id: str, now: datetime) -> None:
    """Sem commit (quem chama decide)."""
    db.execute(
        update(SessionRow).where(SessionRow.user_id == user_id, SessionRow.revoked_at.is_(None)).values(revoked_at=now)
    )
