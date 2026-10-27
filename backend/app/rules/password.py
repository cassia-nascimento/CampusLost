"""Política de senha (B1/5): regra pura e reutilizável + medidor de força.

- mínimo de 10 caracteres;
- limite de 72 BYTES em UTF-8 (limite do bcrypt: recusar é melhor que truncar em silêncio);
- recusa senhas comuns (`common_passwords.txt`) e variações triviais (ex.: `password1234`);
- recusa senha igual ao e-mail, à parte local do e-mail ou ao nome.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

PASSWORD_MIN = 10
PASSWORD_MAX_BYTES = 72

MSG_REQUIRED = "Crie uma senha."
MSG_MIN = f"Use pelo menos {PASSWORD_MIN} caracteres."
MSG_MAX_CHARS = f"Use no máximo {PASSWORD_MAX_BYTES} caracteres."
MSG_MAX_BYTES = (
    "A senha é longa demais. Use uma senha mais curta."
)
MSG_COMMON = "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar."
MSG_PERSONAL = "A senha não pode ser igual ao seu e-mail ou ao seu nome."
MSG_REPETITIVE = "Evite repetições e sequências óbvias (como aaaaaaaaaa ou 1234567890)."

_COMMON_FILE = Path(__file__).with_name("common_passwords.txt")
_SEQUENCES = ("0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm", "9876543210")


@lru_cache(maxsize=1)
def common_passwords() -> frozenset[str]:
    lines = _COMMON_FILE.read_text(encoding="utf-8").splitlines()
    return frozenset(l.strip().lower() for l in lines if l.strip() and not l.startswith("#"))


def _squash(value: str) -> str:
    return re.sub(r"[\s._\-]+", "", value.lower())


def _is_common(password: str) -> bool:
    common = common_passwords()
    low = password.lower()
    if low in common:
        return True
    # `password1234`, `senha@2026!`: tira dígitos e símbolos das pontas e confere de novo.
    core = re.sub(r"^[\W\d_]+|[\W\d_]+$", "", low)
    return len(core) >= 4 and core in common


def _is_repetitive(password: str) -> bool:
    low = password.lower()
    if len(set(low)) <= 2:
        return True
    return any(len(low) <= len(seq) + 2 and low in seq for seq in _SEQUENCES)


def _matches_identity(password: str, email: str | None, name: str | None) -> bool:
    candidates: set[str] = set()
    if isinstance(email, str) and email.strip():
        e = email.strip().lower()
        candidates.update({e, _squash(e), _squash(e.split("@", 1)[0])})
    if isinstance(name, str) and name.strip():
        candidates.update({name.strip().lower(), _squash(name)})
    candidates.discard("")
    return password.lower() in candidates or _squash(password) in candidates


def password_error(password: Any, *, email: str | None = None, name: str | None = None) -> str | None:
    """Primeira mensagem de erro (pt-BR) ou `None` se a senha serve."""
    if not isinstance(password, str) or len(password) < 1:
        return MSG_REQUIRED
    if len(password) < PASSWORD_MIN:
        return MSG_MIN
    if len(password) > PASSWORD_MAX_BYTES:
        return MSG_MAX_CHARS
    if len(password.encode("utf-8")) > PASSWORD_MAX_BYTES:
        return MSG_MAX_BYTES
    if _is_common(password):
        return MSG_COMMON
    if _matches_identity(password, email, name):
        return MSG_PERSONAL
    if _is_repetitive(password):
        return MSG_REPETITIVE
    return None


def password_strength(password: Any, *, email: str | None = None, name: str | None = None) -> dict[str, Any]:
    """Medidor para a interface: `ok` (passa na política), `score` 0 a 4, `label` e `error`.

    O `score` é uma heurística simples (comprimento + variedade de classes); não substitui a política.
    """
    error = password_error(password, email=email, name=name)
    if not isinstance(password, str) or not password:
        return {"ok": False, "score": 0, "label": "Muito fraca", "error": error}
    classes = sum(bool(re.search(p, password)) for p in (r"[a-z]", r"[A-Z]", r"\d", r"[^\w\s]|_", r"[^\x00-\x7f]"))
    score = 0
    if len(password) >= PASSWORD_MIN:
        score = 1
        if len(password) >= 12 and classes >= 2:
            score = 2
        if len(password) >= 14 and classes >= 3:
            score = 3
        if len(password) >= 18 and classes >= 3 or (len(password) >= 16 and classes >= 4):
            score = 4
    if error is not None:
        score = min(score, 1) if error not in (MSG_MIN, MSG_REQUIRED) else 0
    labels = ("Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte")
    return {"ok": error is None, "score": score, "label": labels[score], "error": error}
