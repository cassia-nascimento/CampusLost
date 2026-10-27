"""RF05: devoluções."""

from __future__ import annotations

from fastapi import APIRouter, Request
from sqlalchemy import select

from .. import audit
from ..config import random_id
from ..deps import ClockDep, DbDep, LockDep, OptionalUser, SettingsDep, client_ip, ensure_admin_2fa, find_item, require_user
from ..models import ClaimRow, ReturnCodeRow, ReturnRow, UserRow
from ..rules.items import can_view_stored_at
from ..rules import return_codes as rc
from ..rules.returns import can_register_return, filter_returns_by_period, register_return, sort_returns
from ..rules.decision import assert_allowed
from ..rules.validation import validate_period
from ..schemas import return_view_json

router = APIRouter(tags=["returns"])


def _view(db, r: ReturnRow, viewer: UserRow):
    from ..models import ItemRow

    item = db.get(ItemRow, r.item_id)
    code = db.scalar(select(ReturnCodeRow).where(ReturnCodeRow.claim_id == r.claim_id))
    return return_view_json(
        r, item, db.get(UserRow, r.returned_to_id), db.get(UserRow, r.registered_by_id), viewer,
        can_view_stored_at(viewer, item, []),  # só administração acessa devoluções
        code.verified_at if code else None,
    )


@router.post("/items/{item_id}/return", status_code=201)
def register_item_return(
    item_id: str, request: Request, db: DbDep, actor: OptionalUser, now: ClockDep, lock: LockDep, settings: SettingsDep
):
    user = ensure_admin_2fa(settings, require_user(actor, "register_return"))
    with lock:
        item = find_item(db, item_id)
        claims = list(db.scalars(select(ClaimRow).where(ClaimRow.item_id == item_id)).all())
        assert_allowed(can_register_return(user, item, claims))  # papel/estado primeiro (ITEM_RETURNED etc.)
        accepted = next(c for c in claims if c.status == "accepted")
        instant = now()
        code_row = db.scalar(select(ReturnCodeRow).where(ReturnCodeRow.claim_id == accepted.id))
        # Sem atalho para a administração: exige o código conferido, dentro da validade e ainda não usado.
        rc.assert_ready_for_return(code_row, instant, settings.return_code_verify_ttl_seconds)
        record = register_return(actor=user, item=item, item_claims=claims, return_id=random_id("return"), now=instant)
        code_row.used_at = instant  # mesma transação da devolução: tudo ou nada
        db.add(record)
        audit.record(
            db, instant, audit.RETURN_REGISTER, actor_id=user.id, target_type="item", target_id=item_id,
            ip=client_ip(request), metadata={"returnId": record.id, "claimId": record.claim_id, "codeVerified": True},
            commit=False,
        )
        db.commit()
    return _view(db, record, user)


@router.get("/returns")
def list_returns(request: Request, db: DbDep, actor: OptionalUser, settings: SettingsDep):
    user = ensure_admin_2fa(settings, require_user(actor, "view_returns"))
    period = validate_period(dict(request.query_params))
    rows = db.scalars(select(ReturnRow)).all()
    filtered = filter_returns_by_period(rows, settings.tz, period.get("from"), period.get("to"))
    return [_view(db, r, user) for r in sort_returns(filtered)]
