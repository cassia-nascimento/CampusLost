"""LGPD (B1/8): exportação dos dados do titular e exclusão (anonimização) da conta."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Request, Response
from sqlalchemy import delete, func, or_, select

from .. import login_throttle
from ..clock import to_iso
from ..deps import ClockDep, CurrentUser, DbDep, LockDep, SettingsDep, client_ip
from ..errors import ServiceError
from ..google_auth import verify_google_credential
from ..models import ClaimRow, EmailTokenRow, ItemRow, ReturnRow, SessionRow, UserRow
from ..schemas import claim_json, item_json, return_json
from ..security import verify_password
from ..session_service import clear_auth_cookies

router = APIRouter(prefix="/me", tags=["lgpd"])

REMOVED_NAME = "Usuário removido"
REDACTED = "[Conteúdo removido a pedido do titular dos dados]"


def _iso(value) -> str | None:
    return to_iso(value) if value is not None else None


@router.get("/export")
def export_my_data(response: Response, user: CurrentUser, db: DbDep, settings: SettingsDep, now: ClockDep):
    """Cópia (JSON) de tudo que o sistema guarda sobre a pessoa. Nunca inclui hash de senha nem tokens."""
    items = db.scalars(select(ItemRow).where(ItemRow.created_by_id == user.id).order_by(ItemRow.created_at)).all()
    claims = db.scalars(select(ClaimRow).where(ClaimRow.claimant_id == user.id).order_by(ClaimRow.created_at)).all()
    returns = db.scalars(
        select(ReturnRow).where(or_(ReturnRow.returned_to_id == user.id, ReturnRow.registered_by_id == user.id))
    ).all()
    sessions = db.scalars(select(SessionRow).where(SessionRow.user_id == user.id).order_by(SessionRow.created_at)).all()
    titles = {i.id: i.title for i in (db.get(ItemRow, c.item_id) for c in claims) if i}
    response.headers["Content-Disposition"] = 'attachment; filename="campuslost-meus-dados.json"'
    response.headers["Cache-Control"] = "no-store"
    return {
        "format": "campuslost-export-v1",
        "exportedAt": to_iso(now()),
        "account": {
            "id": user.id, "name": user.name, "email": user.email, "role": user.role, "provider": user.provider,
            "createdAt": _iso(user.created_at), "emailVerifiedAt": _iso(user.email_verified_at),
            "termsAcceptedAt": _iso(user.terms_accepted_at), "termsVersion": user.terms_version,
        },
        "itemsRegistered": [item_json(i) for i in items],
        "claims": [{**claim_json(c), "itemTitle": titles.get(c.item_id)} for c in claims],
        "returns": [
            {**return_json(r), "role": "returnedTo" if r.returned_to_id == user.id else "registeredBy"} for r in returns
        ],
        "sessions": [
            {"id": s.id, "createdAt": _iso(s.created_at), "expiresAt": _iso(s.expires_at), "revokedAt": _iso(s.revoked_at)}
            for s in sessions
        ],
    }


@router.delete("", status_code=204)
def delete_my_account(
    request: Request, user: CurrentUser, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep,
    payload: dict[str, Any] = Body(default_factory=dict),
):
    """Anonimiza a conta. Confirmação: `password` (conta com senha) ou `credential` (ID token Google recente,
    do mesmo e-mail) para contas só-Google. Itens ficam (o autor vira "Usuário removido"); reivindicações em
    aberto são encerradas e os textos delas, apagados."""
    instant = now()
    ip = client_ip(request)
    original_email = user.email
    login_throttle.check_login_allowed(db, original_email, ip, instant)
    if user.password_hash is not None:
        password = payload.get("password")
        ok = isinstance(password, str) and verify_password(password, user.password_hash, settings.bcrypt_rounds)
    else:
        credential = payload.get("credential")
        ok = False
        if isinstance(credential, str) and credential.strip():
            info = verify_google_credential(settings, credential.strip())
            ok = info["email"].strip().lower() == user.email
    if not ok:
        with lock:
            login_throttle.register_failure(db, settings, original_email, ip, instant)
        raise ServiceError(
            "INVALID_CREDENTIALS", "Confirmação incorreta. A conta não foi excluída.",
            {"password": "Confirmação incorreta."}, status_code=403,
        )
    with lock:
        if user.role == "admin":
            admins = db.scalar(
                select(func.count()).select_from(UserRow).where(UserRow.role == "admin", UserRow.deleted_at.is_(None))
            )
            if (admins or 0) <= 1:
                raise ServiceError("CONFLICT", "Você é a única conta de administração. Crie outra antes de excluir esta.")
        _anonymize(db, user, instant)
        db.commit()
    out = Response(status_code=204)
    clear_auth_cookies(out, settings)
    return out


def _anonymize(db, user: UserRow, now) -> None:
    original_email = user.email
    # Reivindicações em aberto (pendentes ou aceitas e ainda não devolvidas) são encerradas; item volta a "disponível"
    # se não restar nenhuma ativa. Os textos de prova (dados pessoais livres) são apagados em todas.
    claims = db.scalars(select(ClaimRow).where(ClaimRow.claimant_id == user.id)).all()
    for c in claims:
        item = db.get(ItemRow, c.item_id)
        if c.status in ("pending", "accepted") and item is not None and item.status != "returned":
            c.status, c.reviewed_at = "rejected", now
            others = db.scalars(select(ClaimRow).where(ClaimRow.item_id == item.id, ClaimRow.id != c.id)).all()
            if item.status == "under_claim" and not any(o.status in ("pending", "accepted") for o in others):
                item.status = "available"
        c.proof_details, c.lost_where_when = REDACTED, REDACTED
    user.name = REMOVED_NAME
    user.email = f"removido-{user.id}@excluido.invalid"
    user.password_hash = None
    user.provider = "deleted"
    user.email_verified_at = None
    user.terms_accepted_at = None
    user.terms_version = None
    user.deleted_at = now
    user.token_version += 1
    db.execute(delete(SessionRow).where(SessionRow.user_id == user.id))
    db.execute(delete(EmailTokenRow).where(EmailTokenRow.user_id == user.id))
    login_throttle.clear_for_email(db, original_email)
