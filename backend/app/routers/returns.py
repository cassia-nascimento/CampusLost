"""RF05: devoluções."""

from __future__ import annotations

from fastapi import APIRouter, Request
from sqlalchemy import select

from .. import audit
from ..config import random_id
from ..deps import ClockDep, DbDep, LockDep, OptionalUser, SettingsDep, client_ip, ensure_admin_2fa, find_item, require_user
from ..models import ClaimRow, ReturnRow, UserRow
from ..rules.returns import filter_returns_by_period, register_return, sort_returns
from ..rules.validation import validate_period
from ..schemas import return_view_json

router = APIRouter(tags=["returns"])


def _view(db, r: ReturnRow):
    from ..models import ItemRow

    return return_view_json(r, db.get(ItemRow, r.item_id), db.get(UserRow, r.returned_to_id), db.get(UserRow, r.registered_by_id))


@router.post("/items/{item_id}/return", status_code=201)
def register_item_return(
    item_id: str, request: Request, db: DbDep, actor: OptionalUser, now: ClockDep, lock: LockDep, settings: SettingsDep
):
    user = ensure_admin_2fa(settings, require_user(actor, "register_return"))
    with lock:
        item = find_item(db, item_id)
        claims = list(db.scalars(select(ClaimRow).where(ClaimRow.item_id == item_id)).all())
        record = register_return(actor=user, item=item, item_claims=claims, return_id=random_id("return"), now=now())
        db.add(record)
        audit.record(
            db, now(), audit.RETURN_REGISTER, actor_id=user.id, target_type="item", target_id=item_id,
            ip=client_ip(request), metadata={"returnId": record.id, "claimId": record.claim_id}, commit=False,
        )
        db.commit()
    return _view(db, record)


@router.get("/returns")
def list_returns(request: Request, db: DbDep, actor: OptionalUser, settings: SettingsDep):
    ensure_admin_2fa(settings, require_user(actor, "view_returns"))
    period = validate_period(dict(request.query_params))
    rows = db.scalars(select(ReturnRow)).all()
    filtered = filter_returns_by_period(rows, settings.tz, period.get("from"), period.get("to"))
    return [_view(db, r) for r in sort_returns(filtered)]
