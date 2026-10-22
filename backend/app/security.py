"""Senhas (bcrypt), tokens (JWT HS256) e limite de tentativas de login."""

from __future__ import annotations

import threading
import time
from collections import deque
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any

import bcrypt
import jwt

from .config import Settings
from .errors import ServiceError

ACCESS = "access"
GOOGLE_PROFILE = "google_profile"
ALGORITHM = "HS256"


def hash_password(password: str, rounds: int = 12) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=rounds)).decode("ascii")


@lru_cache(maxsize=8)
def _dummy_hash(rounds: int) -> str:
    return hash_password("campuslost-dummy-password", rounds)


def verify_password(password: str, password_hash: str | None, rounds: int = 12) -> bool:
    """Sempre executa um bcrypt (mesmo sem conta/senha) para não distinguir os casos pelo tempo."""
    target = password_hash or _dummy_hash(rounds)
    try:
        ok = bcrypt.checkpw(password.encode("utf-8"), target.encode("ascii"))
    except ValueError:  # ex.: senha com mais de 72 bytes
        return False
    return ok and password_hash is not None


def _encode(settings: Settings, claims: dict[str, Any], lifetime: timedelta) -> tuple[str, datetime]:
    now = datetime.now(UTC)
    exp = now + lifetime
    token = jwt.encode({**claims, "iat": now, "exp": exp}, settings.secret_key, algorithm=ALGORITHM)
    return token, exp


def create_access_token(settings: Settings, user_id: str) -> tuple[str, datetime]:
    return _encode(
        settings, {"sub": user_id, "typ": ACCESS}, timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_profile_token(settings: Settings, email: str, name: str) -> str:
    """Prova de perfil Google verificado (10 min). NÃO serve como token de sessão (`typ` diferente)."""
    token, _ = _encode(
        settings,
        {"typ": GOOGLE_PROFILE, "email": email, "name": name},
        timedelta(minutes=settings.profile_token_minutes),
    )
    return token


def decode_token(settings: Settings, token: str, expected_typ: str) -> dict[str, Any] | None:
    """Claims do token, ou `None` se inválido, adulterado, expirado ou de outro tipo."""
    try:
        claims = jwt.decode(
            token, settings.secret_key, algorithms=[ALGORITHM], options={"require": ["exp", "iat"]}
        )
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != expected_typ:
        return None
    return claims


class RateLimiter:
    """Janela deslizante em memória (um processo). Chave: IP + e-mail."""

    def __init__(self, limit: int, window_seconds: int, clock=time.monotonic) -> None:
        self.limit = limit
        self.window = window_seconds
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> None:
        """Registra uma tentativa; lança `RATE_LIMITED` (429) quando passa do limite."""
        if self.limit <= 0:
            return
        now = self._clock()
        with self._lock:
            q = self._hits.setdefault(key, deque())
            while q and now - q[0] >= self.window:
                q.popleft()
            if len(q) >= self.limit:
                retry = max(1, int(self.window - (now - q[0])) + 1)
                raise ServiceError(
                    "RATE_LIMITED",
                    "Muitas tentativas. Aguarde um minuto e tente novamente.",
                    headers={"Retry-After": str(retry)},
                )
            q.append(now)
            if len(self._hits) > 10_000:  # evita crescer sem limite
                for k in [k for k, v in self._hits.items() if not v or now - v[-1] >= self.window]:
                    del self._hits[k]
