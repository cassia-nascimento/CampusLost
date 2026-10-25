"""Validação de entradas: limites e mensagens pt-BR idênticos aos de `frontend/src/lib/validation`.

Cada `validate_*` devolve os dados limpos ou lança `ServiceError("VALIDATION")` com `fieldErrors`
(uma mensagem por campo, a primeira que falhar, como no frontend).
"""

from __future__ import annotations

import re
from typing import Any

from .. import catalog
from ..clock import is_future_date, is_valid_iso_date
from ..errors import ServiceError
from .password import PASSWORD_MAX_BYTES as PASSWORD_MAX
from .password import password_error

ITEM_TITLE_MAX = 80
ITEM_DESCRIPTION_MAX = 500
ITEM_STORED_AT_MAX = 120
CLAIM_PROOF_MAX = 500
CLAIM_WHERE_WHEN_MAX = 300
PHOTO_MAX_BYTES = 10 * 1024 * 1024

SIGNUP_ROLES = ("student", "teacher", "external")
GOOGLE_ROLES = ("student", "teacher")  # Google institucional: aluno/professor; demais e-mails Google nascem `external`
TERMS_MESSAGE = "Aceite os termos de uso e a política de privacidade para continuar."

# Mesma expressão do `z.email()` do zod 4.
_EMAIL_RE = re.compile(r"^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$")

FormErrors = dict[str, str]


class _Fail(Exception):
    def __init__(self, message: str) -> None:
        self.message = message


def _bounded_text(value: Any, label: str, lo: int, hi: int) -> str:
    required = f"Informe {label}."
    if not isinstance(value, str):
        raise _Fail(required)
    v = value.strip()
    if len(v) < 1:
        raise _Fail(required)
    if len(v) < lo:
        raise _Fail(f"Use pelo menos {lo} caracteres.")
    if len(v) > hi:
        raise _Fail(f"Use no máximo {hi} caracteres.")
    return v


def _email(value: Any) -> str:
    if not isinstance(value, str):
        raise _Fail("Informe seu e-mail.")
    v = value.strip().lower()
    if len(v) < 1:
        raise _Fail("Informe seu e-mail.")
    if len(v) > 120:
        raise _Fail("Use no máximo 120 caracteres.")
    if not _EMAIL_RE.match(v):
        raise _Fail("Esse e-mail não parece válido. Use o formato nome@exemplo.com.")
    return v


def _new_password(value: Any, email: Any = None, name: Any = None) -> str:
    """Política de senha completa (`rules/password.py`): 10+ caracteres, <= 72 bytes, não comum, não pessoal."""
    error = password_error(
        value,
        email=email if isinstance(email, str) else None,
        name=name if isinstance(name, str) else None,
    )
    if error:
        raise _Fail(error)
    return value


def _login_password(value: Any) -> str:
    if not isinstance(value, str) or len(value) < 1:
        raise _Fail("Informe sua senha.")
    if len(value) > PASSWORD_MAX:
        raise _Fail(f"Use no máximo {PASSWORD_MAX} caracteres.")
    return value


def _signup_role(value: Any) -> str:
    if value not in SIGNUP_ROLES:
        raise _Fail("Escolha se você é aluno, professor ou da comunidade externa.")
    return value


def _google_role(value: Any) -> str:
    if value not in GOOGLE_ROLES:
        raise _Fail("Escolha se você é aluno ou professor.")
    return value


def _accept_terms(value: Any) -> bool:
    if value is not True:
        raise _Fail(TERMS_MESSAGE)
    return True


def _opaque_token(value: Any) -> str:
    if not isinstance(value, str) or not (16 <= len(value.strip()) <= 200):
        raise _Fail("Link inválido ou expirado.")
    return value.strip()


def _enum(value: Any, options: tuple[str, ...], message: str) -> str:
    if not isinstance(value, str) or value not in options:
        raise _Fail(message)
    return value


def _iso_date(value: Any) -> str:
    if not isinstance(value, str):
        raise _Fail("Informe a data.")
    if not is_valid_iso_date(value):
        raise _Fail("Informe uma data válida.")
    return value


def _run(data: Any, fields: dict[str, Any]) -> dict[str, Any]:
    """`fields`: nome -> função(valor). Coleta a primeira mensagem de cada campo."""
    src = data if isinstance(data, dict) else {}
    out: dict[str, Any] = {}
    errors: FormErrors = {}
    for name, fn in fields.items():
        try:
            out[name] = fn(src.get(name))
        except _Fail as exc:
            errors[name] = exc.message
    if errors:
        raise ServiceError("VALIDATION", "Confira os campos destacados.", errors)
    return out


def normalize_email(value: str) -> str:
    return value.strip().lower()


def validate_signup(data: Any) -> dict[str, Any]:
    src = data if isinstance(data, dict) else {}
    return _run(
        data,
        {
            "name": lambda v: _bounded_text(v, "seu nome", 2, 80),
            "email": _email,
            "password": lambda v: _new_password(v, src.get("email"), src.get("name")),
            "role": _signup_role,
            "acceptTerms": _accept_terms,
        },
    )


def validate_email_only(data: Any) -> dict[str, str]:
    return _run(data, {"email": _email})


def validate_token(data: Any) -> dict[str, str]:
    return _run(data, {"token": _opaque_token})


def validate_reset_request(data: Any) -> dict[str, str]:
    """Token + senha nova. A política completa (e-mail/nome) é reaplicada no servidor depois de achar o usuário."""
    return _run(data, {"token": _opaque_token, "password": lambda v: _new_password(v)})


def validate_signin(data: Any) -> dict[str, str]:
    return _run(data, {"email": _email, "password": _login_password})


def validate_google_signup(data: Any) -> dict[str, str]:
    return _run(
        data,
        {"email": _email, "name": lambda v: _bounded_text(v, "seu nome", 2, 80), "role": _signup_role},
    )


def validate_google_complete(data: Any, *, needs_role: bool) -> dict[str, Any]:
    """Conclusão do cadastro Google: papel (só no domínio institucional) + aceite dos termos."""
    fields: dict[str, Any] = {"acceptTerms": _accept_terms}
    if needs_role:
        fields = {"role": _google_role, **fields}
    return _run(data, fields)


def validate_claim(data: Any) -> dict[str, str]:
    return _run(
        data,
        {
            "proofDetails": lambda v: _bounded_text(v, "os detalhes que só o dono saberia", 10, CLAIM_PROOF_MAX),
            "lostWhereWhen": lambda v: _bounded_text(v, "onde e quando você perdeu o item", 5, CLAIM_WHERE_WHEN_MAX),
        },
    )


def validate_item(data: Any, today: str) -> dict[str, str]:
    """Campos de texto do item (RF02). `today`: dia local de referência (data não pode ser futura)."""

    def found_date(v: Any) -> str:
        d = _iso_date(v)
        if is_future_date(d, today):
            raise _Fail("A data não pode ser no futuro.")
        return d

    return _run(
        data,
        {
            "title": lambda v: _bounded_text(v, "um título", 3, ITEM_TITLE_MAX),
            "description": lambda v: _bounded_text(v, "uma descrição", 10, ITEM_DESCRIPTION_MAX),
            "category": lambda v: _enum(v, catalog.CATEGORIES, "Escolha uma categoria."),
            "foundLocation": lambda v: _enum(v, catalog.LOCATIONS, "Escolha o local onde foi encontrado."),
            "foundDate": found_date,
            "storedAt": lambda v: _bounded_text(v, "onde o item está guardado", 3, ITEM_STORED_AT_MAX),
        },
    )


def _empty_to_none(value: Any) -> Any:
    return None if isinstance(value, str) and value.strip() == "" else value


def _optional(fn):
    def wrapped(value: Any):
        value = _empty_to_none(value)
        return None if value is None else fn(value)

    return wrapped


def _date_value(value: Any) -> str:
    if not isinstance(value, str) or not is_valid_iso_date(value):
        raise _Fail("Informe uma data válida.")
    return value


_optional_date = _optional(_date_value)


def _check_period(out: dict[str, Any], errors: FormErrors) -> None:
    f, t = out.get("from"), out.get("to")
    if f and t and f > t and "to" not in errors:
        errors["to"] = "A data final deve ser igual ou posterior à inicial."


def _validate_query(params: dict[str, Any], fields: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    errors: FormErrors = {}
    for name, fn in fields.items():
        try:
            out[name] = fn(params.get(name))
        except _Fail as exc:
            errors[name] = exc.message
    if not errors:
        _check_period(out, errors)
    if errors:
        raise ServiceError("VALIDATION", "Confira os campos destacados.", errors)
    return {k: v for k, v in out.items() if v is not None}


def validate_item_filters(params: dict[str, Any]) -> dict[str, Any]:
    """Filtros da busca (RF03). Valores vazios são ignorados. Devolve só as chaves presentes."""
    return _validate_query(
        params,
        {
            "category": _optional(lambda v: _enum(v, catalog.CATEGORIES, "Categoria inválida.")),
            "location": _optional(lambda v: _enum(v, catalog.LOCATIONS, "Local inválido.")),
            "from": _optional_date,
            "to": _optional_date,
            "status": _optional(lambda v: _enum(v, ("available", "under_claim"), "Situação inválida.")),
            "sort": _optional(lambda v: _enum(v, ("registered", "found"), "Ordenação inválida.")),
        },
    )


def validate_period(params: dict[str, Any]) -> dict[str, Any]:
    """Período da listagem de devoluções (RF05)."""
    return _validate_query(params, {"from": _optional_date, "to": _optional_date})


def sniff_photo(data: bytes) -> tuple[str, str] | None:
    """Tipo REAL da imagem pelo conteúdo (assinatura): `(mime, extensão)` ou `None`."""
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg", "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", "png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    return None


def validate_photo_bytes(data: bytes) -> tuple[str, str]:
    """Valida o conteúdo da foto (AC02.2). Lança `PHOTO_INVALID` com as mensagens do frontend."""
    if len(data) == 0:
        raise ServiceError("PHOTO_INVALID", "O arquivo está vazio.")
    if len(data) > PHOTO_MAX_BYTES:
        raise ServiceError("PHOTO_INVALID", f"A foto passa de {PHOTO_MAX_BYTES // (1024 * 1024)} MB. Escolha uma menor.")
    kind = sniff_photo(data)
    if kind is None:
        raise ServiceError("PHOTO_INVALID", "Formato não aceito. Use JPG, PNG ou WebP.")
    return kind
