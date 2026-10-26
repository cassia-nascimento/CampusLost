"""Ponto de extensão para Cloudflare Turnstile (captcha). `TURNSTILE_SECRET` vazio = desligado.

Com o segredo definido, signup, login, forgot-password e resend-verification exigem `turnstileToken` no corpo.
Não testado contra a Cloudflare real: nos testes a chamada de rede é substituída (`_siteverify`).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from .config import Settings
from .errors import ServiceError

log = logging.getLogger("campuslost.turnstile")
FAIL_MESSAGE = "Não foi possível confirmar que você não é um robô. Tente novamente."


def _siteverify(settings: Settings, token: str, ip: str | None) -> dict[str, Any]:
    data = {"secret": settings.turnstile_secret, "response": token}
    if ip:
        data["remoteip"] = ip
    resp = httpx.post(settings.turnstile_verify_url, data=data, timeout=5.0)
    resp.raise_for_status()
    body = resp.json()
    return body if isinstance(body, dict) else {}


def verify_turnstile(settings: Settings, payload: Any, ip: str | None) -> None:
    """No-op sem segredo. Com segredo: falha fechada (token ausente, recusado ou Cloudflare fora do ar)."""
    if not settings.turnstile_secret:
        return
    token = payload.get("turnstileToken") if isinstance(payload, dict) else None
    if not isinstance(token, str) or not token.strip() or len(token) > 4096:
        raise ServiceError("CAPTCHA_FAILED", FAIL_MESSAGE)
    try:
        result = _siteverify(settings, token.strip(), ip)
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("Turnstile inacessível: %s", type(exc).__name__)
        raise ServiceError("CAPTCHA_FAILED", FAIL_MESSAGE) from exc
    if result.get("success") is not True:
        raise ServiceError("CAPTCHA_FAILED", FAIL_MESSAGE)
    if settings.turnstile_hostnames:
        hostname = str(result.get("hostname") or "").lower()
        if hostname not in settings.turnstile_hostnames:
            log.warning("Turnstile: hostname fora da lista permitida")
            raise ServiceError("CAPTCHA_FAILED", FAIL_MESSAGE)
