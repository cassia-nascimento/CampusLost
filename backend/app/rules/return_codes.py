"""Código de retirada: confirmação presencial da devolução.

Fluxo: o proprietário confirmado (autor da reivindicação ACEITA) gera o código na própria conta e o informa
pessoalmente; a administração o digita, o backend o valida (`verify`) e, só depois, a entrega é confirmada
(`POST /items/{id}/return`). Validar o código NÃO devolve o item.

Segurança: o texto puro existe só na resposta de geração. No banco fica o HMAC-SHA256 (chave derivada de
`SECRET_KEY` + contexto fixo; mensagem = id da reivindicação + código), exclusivo de cada reivindicação.
Funções puras (sem banco nem relógio próprio) para serem testáveis.
"""

from __future__ import annotations

import hashlib
import hmac
import math
import secrets
from datetime import datetime, timedelta
from typing import Any

from ..errors import ServiceError
from ..models import ClaimRow, ItemRow, ReturnCodeRow
from .decision import ALLOW, Decision, deny

# Sem caracteres ambíguos: nada de 0/O, 1/I/L nem U.
ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
CODE_LENGTH = 8
KEY_CONTEXT = b"return-code"
MAX_INPUT_LENGTH = 64  # entrada acima disso nem é processada (já é inválida)

NOT_ELIGIBLE_MESSAGE = "Só reivindicações aceitas, de itens aguardando devolução, têm código de retirada."
NOT_OWNER_MESSAGE = "Somente quem fez a reivindicação aceita pode gerar o código de retirada."
NOT_ISSUED_MESSAGE = "A pessoa ainda não gerou o código de retirada. Peça para ela gerar em Minhas reivindicações."
NOT_VERIFIED_MESSAGE = "Valide o código de retirada antes de confirmar a entrega."
EXPIRED_MESSAGE = "A conferência do código expirou. Valide o código novamente."
USED_MESSAGE = "Este código de retirada já foi usado."
EMPTY_MESSAGE = "Informe o código de retirada."


def generate_code() -> str:
    """8 caracteres aleatórios (CSPRNG) do alfabeto sem ambíguos, sem hífen."""
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


def format_code(code: str) -> str:
    """`K7M29QXB` -> `K7M2-9QXB` (exibição)."""
    return f"{code[:4]}-{code[4:]}"


def normalize_code(value: Any) -> str:
    """Remove espaços e hífens e põe em maiúsculas. Não texto -> vazio."""
    if not isinstance(value, str):
        return ""
    return "".join(ch for ch in value[:MAX_INPUT_LENGTH] if not ch.isspace() and ch != "-").upper()


def _key(secret_key: str) -> bytes:
    return hmac.new(secret_key.encode("utf-8"), KEY_CONTEXT, hashlib.sha256).digest()


def hash_code(secret_key: str, claim_id: str, code: str) -> str:
    """HMAC-SHA256 em hex (64 caracteres) do código NORMALIZADO, preso ao id da reivindicação."""
    return hmac.new(_key(secret_key), f"{claim_id}:{code}".encode("utf-8"), hashlib.sha256).hexdigest()


def code_matches(secret_key: str, claim_id: str, code: str, stored_hash: str) -> bool:
    """Comparação em tempo constante."""
    return hmac.compare_digest(hash_code(secret_key, claim_id, code), stored_hash)


def can_issue_code(actor: Any, claim: ClaimRow, item: ItemRow) -> Decision:
    """Só o próprio solicitante (identidade da sessão vs. banco), com reivindicação aceita e item aguardando devolução."""
    if actor is None:
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if claim.claimant_id != actor.id:
        return deny("FORBIDDEN", NOT_OWNER_MESSAGE)
    if claim.status != "accepted" or item.status != "under_claim":
        return deny("INVALID_TRANSITION", NOT_ELIGIBLE_MESSAGE)
    return ALLOW


def lock_remaining_seconds(row: ReturnCodeRow, now: datetime) -> int:
    """Segundos de bloqueio que faltam (0 = livre)."""
    if row.locked_until is None or row.locked_until <= now:
        return 0
    return max(1, math.ceil((row.locked_until - now).total_seconds()))


def lock_error(row: ReturnCodeRow, now: datetime) -> ServiceError:
    seconds = lock_remaining_seconds(row, now)
    minutes = max(1, math.ceil(seconds / 60))
    return ServiceError(
        "RATE_LIMITED",
        f"Muitas tentativas incorretas. Aguarde {minutes} minuto(s) para tentar de novo.",
        headers={"Retry-After": str(seconds)},
    )


def verified_until(row: ReturnCodeRow, ttl_seconds: int) -> datetime | None:
    return None if row.verified_at is None else row.verified_at + timedelta(seconds=ttl_seconds)


def is_verified(row: ReturnCodeRow, now: datetime, ttl_seconds: int) -> bool:
    """Conferência vale só dentro da validade e enquanto o código não foi usado."""
    until = verified_until(row, ttl_seconds)
    return until is not None and row.used_at is None and now < until


def assert_ready_for_return(row: ReturnCodeRow | None, now: datetime, ttl_seconds: int) -> None:
    """Pré-condição de `POST /items/{id}/return`: código conferido, dentro da validade e não usado."""
    if row is None or row.verified_at is None:
        raise ServiceError("INVALID_TRANSITION", NOT_VERIFIED_MESSAGE)
    if row.used_at is not None:
        raise ServiceError("INVALID_TRANSITION", USED_MESSAGE)
    if not is_verified(row, now, ttl_seconds):
        raise ServiceError("INVALID_TRANSITION", EXPIRED_MESSAGE)
