from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from ..errors import ServiceError
from ..models import ClaimRow, ItemRow
from .decision import ALLOW, Decision, assert_allowed, deny
from .item_status import assert_transition
from .permissions import email_not_verified, has_capability


def is_active_claim(claim: ClaimRow) -> bool:
    return claim.status in ("pending", "accepted")


def has_accepted_claim(claims: Sequence[ClaimRow]) -> bool:
    return any(c.status == "accepted" for c in claims)


def can_view_claim(actor: Any, claim: ClaimRow) -> Decision:
    """Uma reivindicação só é visível à administração e ao próprio reivindicante."""
    if actor is None:
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if has_capability(actor, "review_claims") or claim.claimant_id == actor.id:
        return ALLOW
    return deny("FORBIDDEN", "Você não tem permissão para ver esta reivindicação.")


def can_claim(actor: Any, item: ItemRow, item_claims: Sequence[ClaimRow]) -> Decision:
    """O usuário pode reivindicar este item? (RF04 / AC04.1, P8, P14)"""
    if actor is None:
        return deny("UNAUTHENTICATED", "Entre para reivindicar este item.")
    if not has_capability(actor, "claim_item"):
        return deny("FORBIDDEN", "A administração analisa reivindicações, mas não reivindica itens.")
    unverified = email_not_verified(actor)
    if unverified:
        return unverified
    if item.status == "returned":
        return deny("ITEM_RETURNED", "Este item já foi devolvido.")
    mine = [c for c in item_claims if c.claimant_id == actor.id]
    if any(c.status == "accepted" for c in mine):
        return deny(
            "DUPLICATE_CLAIM",
            "Sua reivindicação foi aceita. Procure a administração para retirar o item.",
        )
    if any(is_active_claim(c) for c in mine):
        return deny("DUPLICATE_CLAIM", "Você já tem uma reivindicação em andamento para este item.")
    if any(c.status == "rejected" for c in mine):
        return deny(
            "CLAIM_BLOCKED",
            "Sua reivindicação para este item foi recusada. Procure a administração.",
        )
    # Premissa P14: com reivindicação aceita, o item só aguarda a devolução.
    if has_accepted_claim(item_claims):
        return deny("CLAIM_BLOCKED", "Este item já tem uma reivindicação aceita e aguarda a devolução.")
    return ALLOW


def submit_claim(
    *,
    actor: Any,
    item: ItemRow,
    item_claims: Sequence[ClaimRow],
    proof_details: str,
    lost_where_when: str,
    claim_id: str,
    now: datetime,
) -> ClaimRow:
    """Cria a reivindicação; item Disponível -> Em reivindicação (altera `item`)."""
    assert_allowed(can_claim(actor, item, item_claims))
    claim = ClaimRow(
        id=claim_id,
        item_id=item.id,
        claimant_id=actor.id,
        proof_details=proof_details,
        lost_where_when=lost_where_when,
        status="pending",
        created_at=now,
        reviewed_at=None,
    )
    if item.status == "available":
        assert_transition("available", "under_claim")
        item.status = "under_claim"
    return claim


def can_review_claim(actor: Any, item: ItemRow, claim: ClaimRow) -> Decision:
    """Só a administração analisa, e só reivindicações pendentes de itens em reivindicação."""
    if actor is None:
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if not has_capability(actor, "review_claims"):
        return deny("FORBIDDEN", "Somente a administração pode analisar reivindicações.")
    if item.status == "returned":
        return deny("ITEM_RETURNED", "Este item já foi devolvido.")
    if claim.status != "pending":
        return deny("INVALID_TRANSITION", "Esta reivindicação já foi analisada.")
    if item.status != "under_claim":
        return deny("INVALID_TRANSITION", "O item não está em reivindicação.")
    return ALLOW


@dataclass
class ReviewResult:
    claim: ClaimRow
    auto_rejected_ids: list[str]


def review_claim(
    *,
    actor: Any,
    item: ItemRow,
    item_claims: Sequence[ClaimRow],
    claim_id: str,
    decision: str,  # "accept" | "reject"
    now: datetime,
) -> ReviewResult:
    """Aceitar: recusa as demais pendentes; o item continua Em reivindicação.
    Recusar: sem pendente/aceita restante, o item volta a Disponível. Altera `item` e as claims."""
    target = next((c for c in item_claims if c.id == claim_id), None)
    if target is None:
        raise ServiceError("NOT_FOUND", "Reivindicação não encontrada.")
    assert_allowed(can_review_claim(actor, item, target))

    auto_rejected: list[str] = []
    for c in item_claims:
        if c.id == claim_id:
            c.status = "accepted" if decision == "accept" else "rejected"
            c.reviewed_at = now
        elif decision == "accept" and c.status == "pending":
            auto_rejected.append(c.id)
            c.status = "rejected"
            c.reviewed_at = now

    if decision == "reject" and not any(is_active_claim(c) for c in item_claims):
        assert_transition("under_claim", "available")
        item.status = "available"
    return ReviewResult(claim=target, auto_rejected_ids=auto_rejected)
