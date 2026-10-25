"""Dependências do FastAPI: sessão de banco, usuário atual, relógio."""

from __future__ import annotations

import threading
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .config import Settings
from .errors import ServiceError
from .mailer import Mailer
from .models import SessionRow, UserRow
from .rules.decision import assert_allowed
from .rules.permissions import check_capability
from .security import ACCESS, decode_token
from .session_service import ACCESS_COOKIE


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


def get_now(request: Request) -> Callable[[], datetime]:
    return request.app.state.clock


def get_write_lock(request: Request) -> threading.RLock:
    return request.app.state.write_lock


def get_mailer(request: Request) -> Mailer:
    return request.app.state.mailer


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "?"


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]
ClockDep = Annotated[Callable[[], datetime], Depends(get_now)]
LockDep = Annotated[threading.RLock, Depends(get_write_lock)]
MailerDep = Annotated[Mailer, Depends(get_mailer)]


EXPIRED = "Sua sessão expirou. Entre novamente."


SAFE_METHODS = ("GET", "HEAD", "OPTIONS")
CSRF_MESSAGE = "Requisição recusada por segurança. Recarregue a página e tente novamente."


def check_csrf(request: Request, settings: Settings) -> None:
    """Autenticação por cookie + método mutável: exige o cabeçalho `X-Requested-With` (um formulário ou
    `<img>` de outro site não consegue defini-lo; `fetch` de outra origem dispara preflight, que o CORS
    restrito recusa) e, se houver `Origin`, que seja uma origem permitida."""
    if request.method in SAFE_METHODS:
        return
    if not request.headers.get("x-requested-with", "").strip():
        raise ServiceError("CSRF_FAILED", CSRF_MESSAGE)
    origin = request.headers.get("origin")
    if origin is not None and origin not in settings.cors_origins:
        raise ServiceError("CSRF_FAILED", CSRF_MESSAGE)


def user_from_claims(db: Session, claims: dict, now: datetime) -> UserRow | None:
    """Usuário do token, ou `None` se removido/anonimizado, se a senha foi redefinida depois (`tv`) ou se a
    sessão (`sid`) foi revogada/expirou. Tokens sem `sid` (emitidos antes das sessões) só valem pela assinatura."""
    user = db.get(UserRow, claims.get("sub"))
    if user is None or user.deleted_at is not None or user.disabled_at is not None:
        return None
    if claims.get("tv", 0) != user.token_version:
        return None
    sid = claims.get("sid")
    if sid is not None:
        sess = db.get(SessionRow, sid)
        if sess is None or sess.user_id != user.id or sess.revoked_at is not None or sess.expires_at <= now:
            return None
    return user


def optional_user(request: Request, settings: SettingsDep, db: DbDep, now: ClockDep) -> UserRow | None:
    """Usuário autenticado ou `None` (visitante).

    1. `Authorization: Bearer` (precede o cookie; imune a CSRF). Presente mas inválido/expirado/revogado: 401
       (o cliente deve descartar a sessão).
    2. Cookie `cl_access` (HttpOnly). Inválido/expirado: tratado como visitante (listagens públicas continuam
       funcionando; `/auth/me` e as rotas protegidas respondem 401 e o cliente chama `/auth/refresh`).
       Métodos mutáveis exigem proteção CSRF (`check_csrf`)."""
    header = request.headers.get("authorization")
    if header is not None:
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise ServiceError("UNAUTHENTICATED", EXPIRED)
        claims = decode_token(settings, token.strip(), ACCESS)
        if not claims or not isinstance(claims.get("sub"), str):
            raise ServiceError("UNAUTHENTICATED", EXPIRED)
        user = user_from_claims(db, claims, now())
        if user is None:
            raise ServiceError("UNAUTHENTICATED", EXPIRED)
        return user
    cookie = request.cookies.get(ACCESS_COOKIE)
    if cookie:
        claims = decode_token(settings, cookie, ACCESS)
        if claims and isinstance(claims.get("sub"), str):
            user = user_from_claims(db, claims, now())
            if user is not None:
                check_csrf(request, settings)
                return user
    return None


OptionalUser = Annotated[UserRow | None, Depends(optional_user)]


def require_session(actor: UserRow | None) -> UserRow:
    if actor is None:
        raise ServiceError("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    return actor


def require_user(actor: UserRow | None, capability: str) -> UserRow:
    """Sessão + a capacidade (papel) indicada."""
    user = require_session(actor)
    assert_allowed(check_capability(user, capability))
    return user


def current_user(actor: OptionalUser) -> UserRow:
    return require_session(actor)


CurrentUser = Annotated[UserRow, Depends(current_user)]


DEMO_ADMIN_ID = "user-admin"


def admin_two_factor_ok(settings: Settings, user: UserRow) -> bool:
    """Administração precisa de 2FA ligado. Isenções (documentadas): `ADMIN_REQUIRE_2FA=false`, o modo demo
    (`DEMO_MODE=true`, quando a flag não foi definida) e a conta admin do seed demo (`user-admin`) em modo demo."""
    if user.totp_enabled_at is not None or not settings.enforce_admin_2fa:
        return True
    return settings.demo_mode and user.id == DEMO_ADMIN_ID


def require_admin(actor: OptionalUser, settings: SettingsDep) -> UserRow:
    """Rotas `/admin/*`: sessão + papel admin + 2FA (403 `TWO_FACTOR_REQUIRED` até ativar)."""
    user = require_session(actor)
    if user.role != "admin":
        raise ServiceError("FORBIDDEN", "Você não tem permissão para realizar esta ação.")
    if not admin_two_factor_ok(settings, user):
        raise ServiceError(
            "TWO_FACTOR_REQUIRED", "A administração precisa ativar a verificação em duas etapas antes de continuar."
        )
    return user


AdminUser = Annotated[UserRow, Depends(require_admin)]


def demo_guard(settings: SettingsDep) -> None:
    if not settings.demo_mode:
        raise ServiceError("NOT_FOUND", "Recurso não encontrado.")


def find_item(db: Session, item_id: str):
    from .models import ItemRow

    item = db.get(ItemRow, item_id)
    if item is None:
        raise ServiceError("NOT_FOUND", "Item não encontrado.")
    return item
