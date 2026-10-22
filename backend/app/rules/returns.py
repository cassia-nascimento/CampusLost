from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, tzinfo
from typing import Any

from ..clock import to_local_date_string
from ..errors import ServiceError
from ..models import ClaimRow, ItemRow, ReturnRow
from .decision import ALLOW, Decision, assert_allowed, deny
from .item_status import assert_transition
from .permissions import has_capability


def can_register_return(actor: Any, item: ItemRow, item_claims: Sequence[ClaimRow]) -> Decision:
    """Só administração, item em reivindicação e com reivindicação aceita (AC05.1)."""
    if actor is None:
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if not has_capability(actor, "register_return"):
        return deny("FORBIDDEN", "Somente a administração pode registrar devoluções.")
    if item.status == "returned":
        return deny("ITEM_RETURNED", "Este item já foi devolvido.")
    if item.status != "under_claim":
        return deny("INVALID_TRANSITION", "Só é possível devolver um item que está em reivindicação.")
    if not any(c.status == "accepted" for c in item_claims):
        return deny("INVALID_TRANSITION", "Aceite uma reivindicação antes de registrar a devolução.")
    return ALLOW


def register_return(
    *, actor: Any, item: ItemRow, item_claims: Sequence[ClaimRow], return_id: str, now: datetime
) -> ReturnRow:
    """Em reivindicação -> Devolvido (altera `item`), gerando o registro. P19: destinatário = autor da aceita."""
    assert_allowed(can_register_return(actor, item, item_claims))
    accepted = next((c for c in item_claims if c.status == "accepted"), None)
    if accepted is None:
        raise ServiceError("INVALID_TRANSITION", "Nenhuma reivindicação aceita.")
    assert_transition(item.status, "returned")
    item.status = "returned"
    return ReturnRow(
        id=return_id,
        item_id=item.id,
        claim_id=accepted.id,
        returned_to_id=accepted.claimant_id,
        registered_by_id=actor.id,
        returned_at=now,
    )


def filter_returns_by_period(
    records: Sequence[ReturnRow], tz: tzinfo, date_from: str | None = None, date_to: str | None = None
) -> list[ReturnRow]:
    """Período sobre a data local da devolução (inclusive nas duas pontas)."""
    out = []
    for r in records:
        day = to_local_date_string(r.returned_at, tz)
        if date_from and day < date_from:
            continue
        if date_to and day > date_to:
            continue
        out.append(r)
    return out


def sort_returns(records: Sequence[ReturnRow]) -> list[ReturnRow]:
    """Mais recentes primeiro; desempate por id."""
    out = sorted(records, key=lambda r: r.id)
    out.sort(key=lambda r: r.returned_at, reverse=True)
    return out
