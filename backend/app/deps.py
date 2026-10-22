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
from .models import UserRow
from .rules.decision import assert_allowed
from .rules.permissions import check_capability
from .security import ACCESS, RateLimiter, decode_token


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_db(request: Request) -> Iterator[Session]:
    with request.app.state.session_factory() as session:
        yield session


def get_now(request: Request) -> Callable[[], datetime]:
    return request.app.state.clock


def get_write_lock(request: Request) -> threading.RLock:
    return request.app.state.write_lock


def get_limiter(request: Request) -> RateLimiter:
    return request.app.state.limiter


SettingsDep = Annotated[Settings, Depends(get_settings)]
DbDep = Annotated[Session, Depends(get_db)]
ClockDep = Annotated[Callable[[], datetime], Depends(get_now)]
LockDep = Annotated[threading.RLock, Depends(get_write_lock)]


EXPIRED = "Sua sessão expirou. Entre novamente."


def optional_user(request: Request, settings: SettingsDep, db: DbDep) -> UserRow | None:
    """Usuário do `Authorization: Bearer`. Sem cabeçalho: `None` (visitante).
    Token presente mas inválido/expirado/de usuário inexistente: 401 (o cliente deve descartar a sessão)."""
    header = request.headers.get("authorization")
    if header is None:
        return None
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ServiceError("UNAUTHENTICATED", EXPIRED)
    claims = decode_token(settings, token.strip(), ACCESS)
    if not claims or not isinstance(claims.get("sub"), str):
        raise ServiceError("UNAUTHENTICATED", EXPIRED)
    user = db.get(UserRow, claims["sub"])
    if user is None:
        raise ServiceError("UNAUTHENTICATED", EXPIRED)
    return user


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


def demo_guard(settings: SettingsDep) -> None:
    if not settings.demo_mode:
        raise ServiceError("NOT_FOUND", "Recurso não encontrado.")


def find_item(db: Session, item_id: str):
    from .models import ItemRow

    item = db.get(ItemRow, item_id)
    if item is None:
        raise ServiceError("NOT_FOUND", "Item não encontrado.")
    return item
