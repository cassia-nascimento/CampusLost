"""Conclusão de login (B2): conta desativada, desafio de 2FA e auditoria. Usado por senha e Google."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import Request, Response
from sqlalchemy.orm import Session

from . import audit
from .config import Settings
from .deps import client_ip
from .errors import ServiceError
from .models import UserRow
from .security import create_challenge_token
from .session_service import issue_session

DISABLED_MESSAGE = "Esta conta está desativada. Fale com a administração do campus."


def complete_login(
    request: Request, response: Response, db: Session, settings: Settings, user: UserRow, now: datetime, method: str
) -> dict[str, Any]:
    ip = client_ip(request)
    if user.disabled_at is not None:
        audit.record(
            db, now, audit.LOGIN_FAILURE, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
            metadata={"reason": "disabled", "method": method},
        )
        raise ServiceError("ACCOUNT_DISABLED", DISABLED_MESSAGE)
    if user.totp_enabled_at is not None:
        # Senha (ou Google) conferida; falta o segundo fator. Nenhuma sessão nem cookie ainda.
        return {"status": "needs_2fa", "challengeToken": create_challenge_token(settings, user.id)}
    audit.record(
        db, now, audit.LOGIN_SUCCESS, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
        metadata={"method": method},
    )
    return issue_session(db, settings, user, now, response)
