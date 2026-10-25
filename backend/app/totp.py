"""TOTP (RFC 6238) com a biblioteca padrão: HMAC-SHA1, 6 dígitos, passo de 30 s. Sem dependência nova."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
from datetime import datetime, timezone
from urllib.parse import quote

PERIOD = 30
DIGITS = 6
WINDOW = 1  # aceita o passo anterior e o seguinte (relógio do celular levemente fora)
ISSUER = "CampusLost"
RECOVERY_CODES = 8


def new_secret() -> str:
    """160 bits em base32 (32 caracteres, sem padding)."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def hotp(secret: str, counter: int) -> str:
    key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(value % 10**DIGITS).zfill(DIGITS)


def step_at(now: datetime) -> int:
    """Passo de 30 s do instante (`now` naive = UTC, como o relógio da aplicação)."""
    return int(now.replace(tzinfo=timezone.utc).timestamp()) // PERIOD


def verify(secret: str, code: object, now: datetime, last_step: int | None = None) -> int | None:
    """Passo aceito (para gravar como `last_step`) ou `None`. Rejeita reuso: só passos > `last_step`."""
    if not isinstance(code, str):
        return None
    code = code.strip().replace(" ", "")
    if len(code) != DIGITS or not code.isdigit():
        return None
    current = step_at(now)
    found: int | None = None
    for step in range(current - WINDOW, current + WINDOW + 1):
        if hmac.compare_digest(hotp(secret, step), code) and found is None:
            found = step  # sem `break`: tempo de execução não depende de qual passo bateu
    if found is None or (last_step is not None and found <= last_step):
        return None
    return found


def otpauth_uri(secret: str, account: str) -> str:
    label = quote(f"{ISSUER}:{account}", safe="")
    return f"otpauth://totp/{label}?secret={secret}&issuer={quote(ISSUER)}&algorithm=SHA1&digits={DIGITS}&period={PERIOD}"


def new_recovery_codes(count: int = RECOVERY_CODES) -> list[str]:
    """Códigos `xxxxx-xxxxx` (base32 sem ambíguos), 50 bits cada."""
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return ["".join(secrets.choice(alphabet) for _ in range(5)) + "-" + "".join(secrets.choice(alphabet) for _ in range(5)) for _ in range(count)]


def normalize_recovery(code: object) -> str | None:
    if not isinstance(code, str):
        return None
    c = code.strip().lower().replace(" ", "")
    if len(c) == 10 and "-" not in c:
        c = c[:5] + "-" + c[5:]
    return c if len(c) == 11 else None
