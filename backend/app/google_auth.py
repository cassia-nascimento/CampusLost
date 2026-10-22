"""Verificação do ID token do Google chamando o endpoint `tokeninfo` (P30)."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from .config import Settings
from .errors import ServiceError

log = logging.getLogger("campuslost.google")

VALID_ISSUERS = ("accounts.google.com", "https://accounts.google.com")
GENERIC_FAIL = "Não foi possível verificar sua conta Google. Tente novamente."


def fetch_tokeninfo(settings: Settings, credential: str) -> dict[str, Any] | None:
    """GET tokeninfo. `None` se o Google recusou o token. Lança `ServiceError` se o Google ficou inacessível.
    (Os testes substituem esta função.)"""
    try:
        resp = httpx.get(settings.google_tokeninfo_url, params={"id_token": credential}, timeout=5.0)
    except httpx.HTTPError as exc:
        log.warning("tokeninfo inacessível: %s", type(exc).__name__)
        raise ServiceError(
            "UNEXPECTED", "Não foi possível falar com o Google agora. Tente novamente.", status_code=502
        ) from exc
    if resp.status_code != 200:
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def verify_google_credential(settings: Settings, credential: str) -> dict[str, str]:
    """Devolve `{email, name}` de um ID token válido, ou lança `ServiceError`.
    Confere `aud`, `iss`, `exp` e `email_verified`; o domínio é conferido por quem chama."""
    if not settings.google_client_id:
        raise ServiceError("UNEXPECTED", "O login com Google não está configurado.", status_code=503)
    info = fetch_tokeninfo(settings, credential)
    if not info:
        raise ServiceError("UNAUTHENTICATED", GENERIC_FAIL)
    try:
        exp = int(info.get("exp", 0))
    except (TypeError, ValueError):
        exp = 0
    verified = info.get("email_verified")
    ok = (
        info.get("aud") == settings.google_client_id
        and info.get("iss") in VALID_ISSUERS
        and exp > time.time()
        and (verified is True or verified == "true")
        and isinstance(info.get("email"), str)
        and info["email"].strip() != ""
    )
    if not ok:
        raise ServiceError("UNAUTHENTICATED", GENERIC_FAIL)
    name = info.get("name")
    return {"email": info["email"], "name": name if isinstance(name, str) else ""}
