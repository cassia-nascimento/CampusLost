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
    return {**user_json(u), "emailVerified": u.email_verified_at is not None, "hasPassword": u.password_hash is not None}


def public_user_json(u: UserRow) -> dict[str, Any]:
    return {"id": u.id, "name": u.name, "role": u.role}


def item_json(i: ItemRow, *, guest: bool = False) -> dict[str, Any]:
    """Item completo. `guest=True` (visitante, P26): sem `storedAt` e sem `createdById`."""
    out: dict[str, Any] = {
        "id": i.id,
        "title": i.title,
        "description": i.description,
        "category": i.category,
        "foundLocation": i.found_location,
        "foundDate": i.found_date,
    }
    if not guest:
        out["storedAt"] = i.stored_at
    out["photoUrl"] = i.photo_url
    out["status"] = i.status
    if not guest:
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


def claim_view_json(c: ClaimRow, claimant: UserRow, item: ItemRow) -> dict[str, Any]:
    return {**claim_json(c), "claimant": user_json(claimant), "item": item_json(item)}


def return_json(r: ReturnRow) -> dict[str, Any]:
    return {
        "id": r.id,
        "itemId": r.item_id,
        "claimId": r.claim_id,
        "returnedToId": r.returned_to_id,
        "registeredById": r.registered_by_id,
        "returnedAt": to_iso(r.returned_at),
    }


def return_view_json(r: ReturnRow, item: ItemRow, returned_to: UserRow, registered_by: UserRow) -> dict[str, Any]:
    return {
        **return_json(r),
        "item": item_json(item),
        "returnedTo": user_json(returned_to),
        "registeredBy": public_user_json(registered_by),
    }


def decision_json(d: Decision) -> dict[str, Any]:
    return d.to_json()
