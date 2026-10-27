"""Código de retirada da devolução (RF05). Regras em `app/rules/return_codes.py`; contrato em docs/api/API.md.

O texto puro do código aparece SOMENTE na resposta de `POST /claims/{id}/return-code`; nunca em GET, listas,
auditoria, log nem mensagens de erro (o corpo do `verify` não é registrado por nenhum middleware)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Body, Request, Response
from sqlalchemy import select

from .. import audit
from ..clock import to_iso
from ..config import Settings, random_id
from ..deps import ClockDep, DbDep, LockDep, OptionalUser, SettingsDep, client_ip, ensure_admin_2fa, find_item, require_session, require_user
from ..errors import ServiceError
from ..models import ClaimRow, ReturnCodeRow, UserRow
from ..rules import return_codes as rc
from ..rules.decision import assert_allowed
from ..rules.permissions import has_capability

router = APIRouter(tags=["return-codes"])

NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}


def _no_store(response: Response) -> None:
    for k, v in NO_STORE.items():
        response.headers[k] = v


def _claim_or_404(db, claim_id: str) -> ClaimRow:
    claim = db.get(ClaimRow, claim_id)
    if claim is None:
        raise ServiceError("NOT_FOUND", "Reivindicação não encontrada.")
    return claim


def _row_of(db, claim_id: str) -> ReturnCodeRow | None:
    return db.scalar(select(ReturnCodeRow).where(ReturnCodeRow.claim_id == claim_id))


def owner_status(row: ReturnCodeRow | None) -> dict[str, Any]:
    return {"issued": row is not None, "issuedAt": to_iso(row.issued_at) if row else None}


def admin_status(row: ReturnCodeRow | None, settings: Settings, now: datetime) -> dict[str, Any]:
    """Estado para a administração. Nunca inclui o código nem o hash."""
    if row is None:
        return {
            "issued": False, "issuedAt": None, "verified": False, "verifiedAt": None, "verifiedUntil": None,
            "attemptsLeft": settings.return_code_max_attempts, "lockedUntil": None,
        }
    locked = rc.lock_remaining_seconds(row, now) > 0
    return {
        "issued": True,
        "issuedAt": to_iso(row.issued_at),
        "verified": rc.is_verified(row, now, settings.return_code_verify_ttl_seconds),
        "verifiedAt": to_iso(row.verified_at),
        "verifiedUntil": to_iso(rc.verified_until(row, settings.return_code_verify_ttl_seconds)),
        "attemptsLeft": 0 if locked else max(0, settings.return_code_max_attempts - row.failed_attempts),
        "lockedUntil": to_iso(row.locked_until) if locked else None,
    }


@router.post("/claims/{claim_id}/return-code")
def issue_return_code(
    claim_id: str, request: Request, response: Response, db: DbDep, actor: OptionalUser, now: ClockDep, lock: LockDep, settings: SettingsDep
):
    _no_store(response)
    user = require_user(actor, "generate_return_code")  # só usuário comum com e-mail confirmado (admin: 403)
    with lock:
        claim = _claim_or_404(db, claim_id)
        item = find_item(db, claim.item_id)
        assert_allowed(rc.can_issue_code(user, claim, item))  # dono vem da sessão x banco, nunca do corpo
        instant = now()
        code = rc.generate_code()
        digest = rc.hash_code(settings.secret_key, claim.id, code)
        row = _row_of(db, claim.id)
        if row is None:
            db.add(ReturnCodeRow(
                id=random_id("rcode"), claim_id=claim.id, item_id=item.id, code_hash=digest, issued_at=instant, failed_attempts=0,
            ))
        else:  # substitui: o anterior deixa de valer; falhas e bloqueio permanecem (regenerar não destrava)
            row.code_hash, row.issued_at = digest, instant
            row.verified_at, row.verified_by_id = None, None
        audit.record(
            db, instant, audit.RETURN_CODE_ISSUE, actor_id=user.id, target_type="claim", target_id=claim.id,
            ip=client_ip(request), metadata={"itemId": item.id}, commit=False,
        )
        db.commit()
    return {"code": rc.format_code(code), "issuedAt": to_iso(instant)}


@router.get("/claims/{claim_id}/return-code")
def get_return_code_status(
    claim_id: str, response: Response, db: DbDep, actor: OptionalUser, now: ClockDep, settings: SettingsDep
):
    _no_store(response)
    user = require_session(actor)
    claim = _claim_or_404(db, claim_id)
    row = _row_of(db, claim.id)
    if has_capability(user, "register_return"):
        ensure_admin_2fa(settings, user)
        return admin_status(row, settings, now())
    if has_capability(user, "generate_return_code") and claim.claimant_id == user.id:
        return owner_status(row)
    raise ServiceError("FORBIDDEN", "Você não tem permissão para ver esta reivindicação.")


@router.post("/claims/{claim_id}/return-code/verify")
def verify_return_code(
    claim_id: str,
    request: Request,
    response: Response,
    db: DbDep,
    actor: OptionalUser,
    now: ClockDep,
    lock: LockDep,
    settings: SettingsDep,
    payload: dict[str, Any] = Body(...),
):
    _no_store(response)
    admin = ensure_admin_2fa(settings, require_user(actor, "register_return"))
    with lock:  # escrita serializada: contagem de falhas e bloqueio sem corrida
        claim = _claim_or_404(db, claim_id)
        item = find_item(db, claim.item_id)
        if item.status == "returned":
            raise ServiceError("ITEM_RETURNED", "Este item já foi devolvido.")
        if claim.status != "accepted" or item.status != "under_claim":
            raise ServiceError("INVALID_TRANSITION", rc.NOT_ELIGIBLE_MESSAGE)
        row = _row_of(db, claim.id)
        if row is None:
            raise ServiceError("INVALID_TRANSITION", rc.NOT_ISSUED_MESSAGE)
        if row.used_at is not None:
            raise ServiceError("INVALID_TRANSITION", rc.USED_MESSAGE)
        instant = now()
        if rc.lock_remaining_seconds(row, instant) > 0:
            raise rc.lock_error(row, instant)

        typed = rc.normalize_code(payload.get("code"))
        if not typed:  # vazio: erro de preenchimento, não conta tentativa
            raise ServiceError("VALIDATION", "Confira os campos destacados.", {"code": rc.EMPTY_MESSAGE})

        ip = client_ip(request)
        if rc.code_matches(settings.secret_key, claim.id, typed, row.code_hash):
            row.verified_at, row.verified_by_id = instant, admin.id
            row.failed_attempts, row.locked_until = 0, None
            audit.record(
                db, instant, audit.RETURN_CODE_VERIFY, actor_id=admin.id, target_type="claim", target_id=claim.id, ip=ip,
                metadata={"itemId": item.id}, commit=False,
            )
            db.commit()
            return admin_status(row, settings, instant)

        # Incorreto (inclui formato inválido não vazio: não há como distinguir "quase certo" de lixo).
        row.failed_attempts += 1
        left = max(0, settings.return_code_max_attempts - row.failed_attempts)
        audit.record(
            db, instant, audit.RETURN_CODE_FAILURE, actor_id=admin.id, target_type="claim", target_id=claim.id, ip=ip,
            metadata={"itemId": item.id, "attemptsLeft": left}, commit=False,
        )
        if left == 0:
            row.locked_until = instant + timedelta(seconds=settings.return_code_lock_seconds)
            row.failed_attempts = 0
            audit.record(
                db, instant, audit.RETURN_CODE_LOCKED, actor_id=admin.id, target_type="claim", target_id=claim.id, ip=ip,
                metadata={"itemId": item.id, "lockedSeconds": settings.return_code_lock_seconds}, commit=False,
            )
            db.commit()
            raise rc.lock_error(row, instant)
        db.commit()
        raise ServiceError(
            "VALIDATION", "Confira os campos destacados.", {"code": f"Código incorreto. Restam {left} tentativa(s)."}
        )
