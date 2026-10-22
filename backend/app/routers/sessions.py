"""Resposta de sessão compartilhada por login, cadastro, Google e demonstração."""

from __future__ import annotations

from typing import Any

from ..config import Settings
from ..clock import to_iso
from ..models import UserRow
from ..schemas import user_json
from ..security import create_access_token


def session_response(settings: Settings, user: UserRow) -> dict[str, Any]:
    token, exp = create_access_token(settings, user.id)
    return {
        "token": token,
        "tokenType": "bearer",
        "expiresAt": to_iso(exp.replace(tzinfo=None)),
        "user": user_json(user),
    }
