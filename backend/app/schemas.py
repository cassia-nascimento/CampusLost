"""Serialização JSON (contrato com `frontend/src/services/contracts.ts`). Ver docs/api/API.md."""

from __future__ import annotations

from typing import Any

from .clock import to_iso
from .models import ClaimRow, ItemRow, ReturnRow, UserRow
from .rules.decision import Decision


def user_json(u: UserRow) -> dict[str, Any]:
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role}


def account_json(u: UserRow) -> dict[str, Any]:
    """Usuário da própria sessão: `User` + `emailVerified` (o cliente mostra o aviso de confirmação)."""
    return {**user_json(u), "emailVerified": u.email_verified_at is not None, "hasPassword": u.password_hash is not None, "affiliation": u.affiliation,
            "twoFactorEnabled": u.totp_enabled_at is not None}


def public_user_json(u: UserRow) -> dict[str, Any]:
    return {"id": u.id, "name": u.name, "role": u.role}


def item_json(i: ItemRow, viewer: UserRow | None, stored_visible: bool) -> dict[str, Any]:
    """Item completo para `viewer` (o ator da requisição, ou `None` = visitante).

    `storedAt` (local de guarda) só aparece quando `stored_visible` (calculado pelo chamador com
    `rules.items.can_view_stored_at`: admin, ou reivindicante aceito com item aguardando devolução); senão a chave é omitida.
    `createdById` só aparece quando há sessão (P26). `categoryOther` é público (string ou null)."""
    out: dict[str, Any] = {
        "id": i.id,
        "title": i.title,
        "description": i.description,
        "category": i.category,
        "categoryOther": i.category_detail,
        "foundLocation": i.found_location,
        "foundDate": i.found_date,
    }
    if stored_visible:
        out["storedAt"] = i.stored_at
    out["photoUrl"] = i.photo_url
    out["status"] = i.status
    if viewer is not None:
        out["createdById"] = i.created_by_id
    out["createdAt"] = to_iso(i.created_at)
    return out


def claim_json(c: ClaimRow) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": c.id,
        "itemId": c.item_id,
        "claimantId": c.claimant_id,
        "proofDetails": c.proof_details,
        "lostWhereWhen": c.lost_where_when,
        "status": c.status,
        "createdAt": to_iso(c.created_at),
    }
    if c.reviewed_at is not None:
        out["reviewedAt"] = to_iso(c.reviewed_at)
    return out


def claim_with_claimant_json(c: ClaimRow, claimant: UserRow) -> dict[str, Any]:
    return {**claim_json(c), "claimant": user_json(claimant)}


def claim_view_json(c: ClaimRow, claimant: UserRow, item: ItemRow, viewer: UserRow | None, stored_visible: bool) -> dict[str, Any]:
    return {**claim_json(c), "claimant": user_json(claimant), "item": item_json(item, viewer, stored_visible)}


def return_json(r: ReturnRow) -> dict[str, Any]:
    return {
        "id": r.id,
        "itemId": r.item_id,
        "claimId": r.claim_id,
        "returnedToId": r.returned_to_id,
        "registeredById": r.registered_by_id,
        "returnedAt": to_iso(r.returned_at),
    }


def return_view_json(r: ReturnRow, item: ItemRow, returned_to: UserRow, registered_by: UserRow, viewer: UserRow | None, stored_visible: bool) -> dict[str, Any]:
    return {
        **return_json(r),
        "item": item_json(item, viewer, stored_visible),
        "returnedTo": user_json(returned_to),
        "registeredBy": public_user_json(registered_by),
    }


def decision_json(d: Decision) -> dict[str, Any]:
    return d.to_json()
