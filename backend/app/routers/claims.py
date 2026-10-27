"""RF04: reivindicações."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .. import audit
from ..config import random_id
from ..deps import ClockDep, DbDep, LockDep, OptionalUser, SettingsDep, client_ip, ensure_admin_2fa, find_item, require_session, require_user
from ..errors import ServiceError
from ..models import ClaimRow, ItemRow, UserRow
from ..rules.claims import can_view_claim, review_claim, submit_claim
from ..rules.decision import assert_allowed
from ..rules.validation import validate_claim
from ..schemas import claim_json, claim_view_json, item_json

router = APIRouter(tags=["claims"])


def _view(db, c: ClaimRow, viewer: UserRow | None) -> dict[str, Any]:
    return claim_view_json(c, db.get(UserRow, c.claimant_id), db.get(ItemRow, c.item_id), viewer)


def _item_claims(db, item_id: str) -> list[ClaimRow]:
    return list(db.scalars(select(ClaimRow).where(ClaimRow.item_id == item_id)).all())


@router.post("/items/{item_id}/claims", status_code=201)
def create_claim(
    item_id: str, payload: dict[str, Any] = Body(...), *, db: DbDep, actor: OptionalUser, now: ClockDep, lock: LockDep
):
    # Mesma ordem do mock: valida o corpo antes de checar sessão/papel.
    data = validate_claim(payload)
    user = require_user(actor, "claim_item")
    with lock:
        item = find_item(db, item_id)
        claim = submit_claim(
            actor=user, item=item, item_claims=_item_claims(db, item_id),
            proof_details=data["proofDetails"], lost_where_when=data["lostWhereWhen"],
            claim_id=random_id("claim"), now=now(),
        )
        db.add(claim)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise ServiceError("DUPLICATE_CLAIM", "Você já tem uma reivindicação em andamento para este item.") from None
    return claim_json(claim)


@router.get("/items/{item_id}/claims")
def list_claims_by_item(item_id: str, db: DbDep, actor: OptionalUser, settings: SettingsDep):
    user = ensure_admin_2fa(settings, require_user(actor, "review_claims"))
    find_item(db, item_id)
    return [_view(db, c, user) for c in sorted(_item_claims(db, item_id), key=lambda c: c.created_at)]


@router.get("/claims/mine")
def list_my_claims(db: DbDep, actor: OptionalUser):
    user = require_user(actor, "view_own_claims")
    rows = db.scalars(select(ClaimRow).where(ClaimRow.claimant_id == user.id)).all()
    return [_view(db, c, user) for c in sorted(rows, key=lambda c: c.created_at, reverse=True)]


@router.get("/claims/pending")
def list_pending_claims(db: DbDep, actor: OptionalUser, settings: SettingsDep):
    user = ensure_admin_2fa(settings, require_user(actor, "review_claims"))
    rows = db.scalars(select(ClaimRow).where(ClaimRow.status == "pending")).all()
    return [_view(db, c, user) for c in sorted(rows, key=lambda c: c.created_at)]


@router.get("/claims/{claim_id}")
def get_claim(claim_id: str, db: DbDep, actor: OptionalUser):
    user = require_session(actor)
    claim = db.get(ClaimRow, claim_id)
    if claim is None:
        raise ServiceError("NOT_FOUND", "Reivindicação não encontrada.")
    assert_allowed(can_view_claim(user, claim))
    return _view(db, claim, user)


def _decide(request: Request, claim_id: str, decision: str, db, actor, now, lock, settings) -> dict[str, Any]:
    user = ensure_admin_2fa(settings, require_user(actor, "review_claims"))
    with lock:
        target = db.get(ClaimRow, claim_id)
        if target is None:
            raise ServiceError("NOT_FOUND", "Reivindicação não encontrada.")
        item = find_item(db, target.item_id)
        result = review_claim(
            actor=user, item=item, item_claims=_item_claims(db, item.id),
            claim_id=claim_id, decision=decision, now=now(),
        )
        audit.record(
            db, now(), audit.CLAIM_ACCEPT if decision == "accept" else audit.CLAIM_REJECT, actor_id=user.id,
            target_type="claim", target_id=claim_id, ip=client_ip(request),
            metadata={"itemId": item.id, "autoRejected": len(result.auto_rejected_ids)}, commit=False,
        )
        db.commit()
    return {"claim": claim_json(result.claim), "item": item_json(item, user), "autoRejectedIds": result.auto_rejected_ids}


@router.post("/claims/{claim_id}/accept")
def accept_claim(claim_id: str, request: Request, db: DbDep, actor: OptionalUser, now: ClockDep, lock: LockDep, settings: SettingsDep):
    return _decide(request, claim_id, "accept", db, actor, now, lock, settings)


@router.post("/claims/{claim_id}/reject")
def reject_claim(claim_id: str, request: Request, db: DbDep, actor: OptionalUser, now: ClockDep, lock: LockDep, settings: SettingsDep):
    return _decide(request, claim_id, "reject", db, actor, now, lock, settings)
