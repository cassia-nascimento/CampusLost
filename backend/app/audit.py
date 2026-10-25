"""Trilha de auditoria (B2). Uma linha em `audit_log` por evento relevante.

Regra de ouro: NUNCA gravar senha, token, segredo TOTP nem código. `record` descarta qualquer chave de
`metadata` com nome sensível e limita o tamanho dos valores; quem chama deve passar só dados não sensíveis.
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from .models import AuditLogRow

# Ações registradas (o filtro `?action=` da API usa estes nomes).
LOGIN_SUCCESS = "login.success"
LOGIN_FAILURE = "login.failure"
LOGIN_BLOCKED = "login.blocked"
LOGOUT = "logout"
SIGNUP = "signup"
VERIFY_EMAIL = "email.verify"
PASSWORD_RESET = "password.reset"
ROLE_CHANGE = "user.role_change"
USER_DISABLE = "user.disable"
USER_ENABLE = "user.enable"
CLAIM_ACCEPT = "claim.accept"
CLAIM_REJECT = "claim.reject"
RETURN_REGISTER = "return.register"
ITEM_DELETE = "item.delete"
ACCOUNT_DELETE = "account.delete"
TWOFA_ENABLE = "2fa.enable"
TWOFA_DISABLE = "2fa.disable"
TWOFA_FAILURE = "2fa.failure"
INVITE_CREATE = "invite.create"
INVITE_REVOKE = "invite.revoke"
INVITE_ACCEPT = "invite.accept"

_SENSITIVE_PARTS = ("password", "senha", "token", "secret", "segredo", "code", "codigo", "hash", "credential", "cookie")
_MAX_VALUE = 200


def email_fingerprint(email: str) -> str:
    """Identificador estável, sem expor o texto digitado (que pode ser uma senha no campo errado)."""
    return hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()[:12]


def clean_metadata(meta: dict[str, Any] | None) -> dict[str, Any] | None:
    if not meta:
        return None
    out: dict[str, Any] = {}
    for key, value in meta.items():
        if any(part in str(key).lower() for part in _SENSITIVE_PARTS):
            continue
        if isinstance(value, (bool, int, float)) or value is None:
            out[str(key)] = value
        else:
            out[str(key)] = str(value)[:_MAX_VALUE]
    return out or None


def record(
    db: Session,
    now: datetime,
    action: str,
    *,
    actor_id: str | None,
    target_type: str | None = None,
    target_id: str | None = None,
    ip: str | None = None,
    metadata: dict[str, Any] | None = None,
    commit: bool = True,
) -> None:
    """Adiciona o evento. `commit=False` deixa a linha na mesma transação da mudança auditada (atômico)."""
    db.add(
        AuditLogRow(
            at=now, actor_id=actor_id, action=action, target_type=target_type, target_id=target_id,
            ip=ip[:64] if ip else None, meta=clean_metadata(metadata),
        )
    )
    if commit:
        db.commit()
