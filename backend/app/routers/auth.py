"""RF01: cadastro, login, sessão atual e Google institucional (P30)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ..config import random_id
from ..deps import ClockDep, DbDep, LockDep, OptionalUser, SettingsDep, require_session
from ..errors import ServiceError
from ..google_auth import verify_google_credential
from ..models import UserRow
from ..rules.google import is_allowed_google_email
from ..rules.validation import normalize_email, validate_google_role, validate_signin, validate_signup
from ..schemas import user_json
from ..security import GOOGLE_PROFILE, create_profile_token, decode_token, hash_password, verify_password
from .sessions import session_response

router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos."
EMAIL_TAKEN_MESSAGE = "Este e-mail já está cadastrado."
INSTITUTIONAL_MESSAGE = "Use o e-mail institucional da UNDB."


def _email_taken() -> ServiceError:
    return ServiceError("EMAIL_TAKEN", EMAIL_TAKEN_MESSAGE, {"email": EMAIL_TAKEN_MESSAGE})


def _find_by_email(db, email: str) -> UserRow | None:
    return db.scalar(select(UserRow).where(UserRow.email == email))


def _normalize_google_profile(email: str, name: str) -> dict[str, str]:
    """E-mail normalizado; nome aparado, limitado a 80 e, se curto demais, a parte local do e-mail."""
    email = normalize_email(str(email or ""))
    name = str(name or "").strip()[:80].strip()
    if len(name) < 2:
        name = email.split("@")[0]
    return {"email": email, "name": name}


def _assert_institutional(settings, email: str) -> None:
    if not is_allowed_google_email(email, settings.google_allowed_domains):
        raise ServiceError("FORBIDDEN_DOMAIN", INSTITUTIONAL_MESSAGE)


@router.post("/signup", status_code=201)
def signup(payload: dict[str, Any] = Body(...), *, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep):
    data = validate_signup(payload)
    pw_hash = hash_password(data["password"], settings.bcrypt_rounds)
    with lock:
        if _find_by_email(db, data["email"]):
            raise _email_taken()
        user = UserRow(
            id=random_id("user"), name=data["name"], email=data["email"], role=data["role"],
            provider="password", password_hash=pw_hash, created_at=now(),
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise _email_taken() from None
    return session_response(settings, user)


@router.post("/login")
def login(request: Request, payload: dict[str, Any] = Body(...), *, db: DbDep, settings: SettingsDep):
    raw_email = payload.get("email")
    key = f"{request.client.host if request.client else '?'}|{raw_email.strip().lower() if isinstance(raw_email, str) else ''}"
    request.app.state.limiter.hit(key)

    data = validate_signin(payload)
    user = _find_by_email(db, data["email"])
    # Sempre roda um bcrypt (mesmo sem conta ou para conta só-Google): erro único, sem revelar qual.
    ok = verify_password(data["password"], user.password_hash if user else None, settings.bcrypt_rounds)
    if user is None or not ok:
        raise ServiceError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE)
    return session_response(settings, user)


@router.get("/me")
def me(actor: OptionalUser):
    """Sessão atual. Sem token (ou token inválido): 401 — o cliente trata como "sem sessão"."""
    return user_json(require_session(actor))


@router.post("/google")
def google_sign_in(payload: dict[str, Any] = Body(...), *, db: DbDep, settings: SettingsDep):
    credential = payload.get("credential")
    if not isinstance(credential, str) or not credential.strip() or len(credential) > 8192:
        raise ServiceError("VALIDATION", "Confira os campos destacados.", {"credential": "Credencial do Google ausente."})
    verified = verify_google_credential(settings, credential.strip())
    profile = _normalize_google_profile(verified["email"], verified["name"])
    _assert_institutional(settings, profile["email"])
    user = _find_by_email(db, profile["email"])
    if user is None:
        return {
            "status": "needs_role",
            "profile": profile,
            "profileToken": create_profile_token(settings, profile["email"], profile["name"]),
        }
    return {"status": "signed_in", **session_response(settings, user)}


@router.post("/google/complete", status_code=201)
def google_complete(payload: dict[str, Any] = Body(...), *, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep):
    token = payload.get("profileToken")
    claims = decode_token(settings, token, GOOGLE_PROFILE) if isinstance(token, str) else None
    if not claims or not isinstance(claims.get("email"), str):
        raise ServiceError("UNAUTHENTICATED", "Sua verificação do Google expirou. Entre com o Google novamente.")
    profile = _normalize_google_profile(claims["email"], claims.get("name", ""))
    _assert_institutional(settings, profile["email"])
    role = validate_google_role(payload)["role"]
    with lock:
        if _find_by_email(db, profile["email"]):
            raise _email_taken()
        user = UserRow(
            id=random_id("user"), name=profile["name"], email=profile["email"], role=role,
            provider="google", password_hash=None, created_at=now(),
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise _email_taken() from None
    return session_response(settings, user)
