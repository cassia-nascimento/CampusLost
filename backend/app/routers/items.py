"""RF02/RF03: itens (lista pública, detalhe, registrar, editar, excluir)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from starlette.datastructures import UploadFile

from .. import audit
from ..clock import local_today
from ..config import random_id
from ..deps import ClockDep, accepted_claims_of, DbDep, LockDep, OptionalUser, SettingsDep, client_ip, ensure_admin_2fa, find_item, require_session, require_user
from ..errors import ServiceError
from ..models import ClaimRow, ItemRow, ReturnRow, UserRow
from ..photos import delete_photo_file, save_photo
from ..rules.claims import can_claim
from ..rules.decision import assert_allowed
from ..rules.items import can_delete_item, can_edit_item, can_view_stored_at, is_visible_in_search, search_items
from ..rules.permissions import check_capability, has_capability
from ..rules.returns import can_register_return
from ..rules.validation import PHOTO_MAX_BYTES, validate_item, validate_item_filters, validate_photo_bytes
from ..schemas import claim_json, claim_with_claimant_json, item_json, public_user_json, return_json, user_json

router = APIRouter(prefix="/items", tags=["items"])

ITEM_FIELDS = ("title", "description", "category", "categoryOther", "foundLocation", "foundDate", "storedAt")


@dataclass
class ItemForm:
    fields: dict[str, Any]
    photo: bytes | None  # None = nenhum arquivo enviado
    photo_invalid: bool  # o campo `photo` veio, mas não é um arquivo
    remove_photo: bool


async def read_item_form(request: Request) -> ItemForm:
    """Lê o multipart/form-data do item (campos de texto + `photo` opcional + `removePhoto`)."""
    form = await request.form(max_files=2, max_fields=20)
    fields = {k: form.get(k) for k in ITEM_FIELDS}
    fields = {k: (v if isinstance(v, str) else None) for k, v in fields.items()}
    raw = form.get("photo")
    photo: bytes | None = None
    invalid = False
    if isinstance(raw, UploadFile):
        data = await raw.read(PHOTO_MAX_BYTES + 1)
        if not (not raw.filename and len(data) == 0):  # parte vazia enviada pelo navegador = sem foto
            photo = data
    elif isinstance(raw, str) and raw.strip() != "":
        invalid = True
    remove = str(form.get("removePhoto") or "").strip().lower() in {"1", "true", "on", "yes"}
    await form.close()
    return ItemForm(fields=fields, photo=photo, photo_invalid=invalid, remove_photo=remove)


ItemFormDep = Annotated[ItemForm, Depends(read_item_form)]


def _store_new_photo(settings, form: ItemForm) -> str | None:
    """Valida (conteúdo real) e grava a foto. `None` se não houve foto."""
    if form.photo_invalid:
        raise ServiceError("PHOTO_INVALID", "Formato não aceito. Use JPG, PNG ou WebP.")
    if form.photo is None:
        return None
    _mime, ext = validate_photo_bytes(form.photo)
    return save_photo(settings, form.photo, ext)


@router.get("")
def list_items(request: Request, db: DbDep, actor: OptionalUser):
    """Busca pública (P26). Nunca devolve itens Devolvidos."""
    assert_allowed(check_capability(actor, "search_items"))
    filters = validate_item_filters(dict(request.query_params))
    items = search_items(db.scalars(select(ItemRow)).all(), filters)
    mine = accepted_claims_of(db, actor)  # uma consulta para a lista inteira
    return [item_json(i, actor, can_view_stored_at(actor, i, mine)) for i in items]


@router.get("/{item_id}")
def get_item(item_id: str, db: DbDep, actor: OptionalUser):
    assert_allowed(check_capability(actor, "search_items"))
    item = find_item(db, item_id)
    claims = list(db.scalars(select(ClaimRow).where(ClaimRow.item_id == item_id)).all())

    def viewer(user: UserRow | None) -> dict[str, Any]:
        return {
            "claim": can_claim(user, item, claims).to_json(),
            "edit": can_edit_item(user, item).to_json(),
            "delete": can_delete_item(user, item).to_json(),
            "registerReturn": can_register_return(user, item, claims).to_json(),
        }

    if actor is None:
        # Visitante: devolvido é invisível (mesmo erro de item inexistente) e nada de terceiros.
        if not is_visible_in_search(item):
            raise ServiceError("NOT_FOUND", "Item não encontrado.")
        return {
            "item": item_json(item, None, False),
            "createdBy": None,
            "myClaims": [],
            "claims": [],
            "returnRecord": None,
            "viewer": viewer(None),
        }

    creator = db.get(UserRow, item.created_by_id)
    mine = sorted((c for c in claims if c.claimant_id == actor.id), key=lambda c: c.created_at, reverse=True)
    all_claims: list[dict[str, Any]] = []
    if has_capability(actor, "review_claims"):
        for c in sorted(claims, key=lambda c: c.created_at):
            all_claims.append(claim_with_claimant_json(c, db.get(UserRow, c.claimant_id)))
    record = None
    if has_capability(actor, "view_returns"):
        record = db.scalar(select(ReturnRow).where(ReturnRow.item_id == item_id))
    return {
        "item": item_json(item, actor, can_view_stored_at(actor, item, claims)),
        "createdBy": public_user_json(creator),
        "myClaims": [claim_json(c) for c in mine],
        "claims": all_claims,
        "returnRecord": return_json(record) if record else None,
        "viewer": viewer(actor),
    }


@router.post("", status_code=201)
def create_item(form: ItemFormDep, db: DbDep, actor: OptionalUser, settings: SettingsDep, now: ClockDep, lock: LockDep):
    user = require_user(actor, "register_item")
    instant = now()
    fields = validate_item(form.fields, local_today(instant, settings.tz))
    photo_url = _store_new_photo(settings, form)
    try:
        with lock:
            item = ItemRow(
                id=random_id("item"), title=fields["title"], description=fields["description"],
                category=fields["category"], category_detail=fields["categoryOther"], found_location=fields["foundLocation"], found_date=fields["foundDate"],
                stored_at=fields["storedAt"], photo_url=photo_url, status="available",
                created_by_id=user.id, created_at=instant,
            )
            db.add(item)
            db.commit()
    except SQLAlchemyError:
        db.rollback()
        delete_photo_file(settings, photo_url)
        raise
    return item_json(item, user, can_view_stored_at(user, item, []))  # recém-criado/editado: só admin


@router.put("/{item_id}")
def update_item(item_id: str, form: ItemFormDep, db: DbDep, actor: OptionalUser, settings: SettingsDep, now: ClockDep, lock: LockDep):
    user = require_session(actor)
    with lock:
        item = find_item(db, item_id)
        assert_allowed(can_edit_item(user, item))
        ensure_admin_2fa(settings, user)
        fields = validate_item(form.fields, local_today(now(), settings.tz))
        new_url = _store_new_photo(settings, form)
        old_url = item.photo_url
        try:
            item.title, item.description = fields["title"], fields["description"]
            item.category, item.category_detail = fields["category"], fields["categoryOther"]
            item.found_location = fields["foundLocation"]
            item.found_date, item.stored_at = fields["foundDate"], fields["storedAt"]
            if new_url:  # arquivo novo vence `removePhoto` (como no mock)
                item.photo_url = new_url
            elif form.remove_photo:
                item.photo_url = None
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            delete_photo_file(settings, new_url)
            raise
        if item.photo_url != old_url:
            delete_photo_file(settings, old_url)
    return item_json(item, user, can_view_stored_at(user, item, []))  # recém-criado/editado: só admin


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, request: Request, db: DbDep, actor: OptionalUser, settings: SettingsDep, lock: LockDep, now: ClockDep):
    user = require_session(actor)
    with lock:
        item = find_item(db, item_id)
        assert_allowed(can_delete_item(user, item))
        ensure_admin_2fa(settings, user)
        photo = item.photo_url
        # P18: a exclusão remove também as reivindicações do item.
        for c in db.scalars(select(ClaimRow).where(ClaimRow.item_id == item_id)).all():
            db.delete(c)
        db.flush()
        audit.record(
            db, now(), audit.ITEM_DELETE, actor_id=user.id, target_type="item", target_id=item_id, ip=client_ip(request),
            metadata={"title": item.title, "status": item.status}, commit=False,
        )
        db.delete(item)
        db.commit()
        delete_photo_file(settings, photo)
    return Response(status_code=204)
