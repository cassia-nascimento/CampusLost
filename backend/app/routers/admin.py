"""Administração (B2): auditoria, gestão de usuários e convites de administração. Tudo exige admin + 2FA."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Body, Request, Response
from sqlalchemy import func, or_, select

from .. import audit
from ..clock import to_iso
from ..config import random_id
from ..deps import AdminUser, ClockDep, DbDep, LockDep, MailerDep, SettingsDep, client_ip
from ..errors import ServiceError
from ..mailer import admin_invite_email, deliver
from ..models import AdminInviteRow, AuditLogRow, UserRow
from ..rules.validation import validate_email_only
from ..security import hash_token, new_opaque_token
from ..session_service import revoke_all_sessions

router = APIRouter(prefix="/admin", tags=["admin"])

ROLES = ("student", "teacher", "external", "admin")
PAGE_SIZE_DEFAULT = 20
PAGE_SIZE_MAX = 100


def _page_params(request: Request) -> tuple[int, int]:
    def num(name: str, default: int, lo: int, hi: int) -> int:
        raw = request.query_params.get(name)
        if raw in (None, ""):
            return default
        if not raw.isdigit() or not (lo <= int(raw) <= hi):
            raise ServiceError("VALIDATION", "Confira os campos destacados.", {name: f"Use um número de {lo} a {hi}."})
        return int(raw)

    return num("page", 1, 1, 1_000_000), num("pageSize", PAGE_SIZE_DEFAULT, 1, PAGE_SIZE_MAX)


def _page(items: list[dict[str, Any]], total: int, page: int, size: int) -> dict[str, Any]:
    return {"items": items, "page": page, "pageSize": size, "total": total, "totalPages": max(1, -(-total // size))}


def _like(term: str) -> str:
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


# --- auditoria --------------------------------------------------------------------------------------------------


@router.get("/audit")
def list_audit(request: Request, _: AdminUser, db: DbDep):
    """`?action=` (exato), `?actor=` (id do usuário), `?page=` / `?pageSize=`. Mais recentes primeiro."""
    page, size = _page_params(request)
    where = []
    action = request.query_params.get("action", "").strip()
    actor = request.query_params.get("actor", "").strip()
    if action:
        where.append(AuditLogRow.action == action)
    if actor:
        where.append(AuditLogRow.actor_id == actor)
    total = db.scalar(select(func.count()).select_from(AuditLogRow).where(*where)) or 0
    rows = db.scalars(
        select(AuditLogRow).where(*where).order_by(AuditLogRow.at.desc(), AuditLogRow.id.desc())
        .limit(size).offset((page - 1) * size)
    ).all()
    names = {u.id: u for u in db.scalars(select(UserRow).where(UserRow.id.in_({r.actor_id for r in rows if r.actor_id}))).all()}
    items = [
        {
            "id": r.id, "at": to_iso(r.at), "actorId": r.actor_id,
            "actorName": names[r.actor_id].name if r.actor_id in names else None,
            "action": r.action, "targetType": r.target_type, "targetId": r.target_id, "ip": r.ip, "metadata": r.meta,
        }
        for r in rows
    ]
    return _page(items, total, page, size)


# --- usuários ---------------------------------------------------------------------------------------------------


def admin_user_json(u: UserRow) -> dict[str, Any]:
    return {
        "id": u.id, "name": u.name, "email": u.email, "role": u.role, "provider": u.provider,
        "active": u.disabled_at is None, "disabledAt": to_iso(u.disabled_at) if u.disabled_at else None,
        "emailVerified": u.email_verified_at is not None, "twoFactorEnabled": u.totp_enabled_at is not None,
        "createdAt": to_iso(u.created_at),
    }


@router.get("/users")
def list_users(request: Request, _: AdminUser, db: DbDep):
    """`?q=` (nome ou e-mail), `?role=`, `?status=active|disabled`, `?page=` / `?pageSize=`. Contas excluídas (LGPD) ficam de fora."""
    page, size = _page_params(request)
    where = [UserRow.deleted_at.is_(None)]
    q = request.query_params.get("q", "").strip()
    role = request.query_params.get("role", "").strip()
    status = request.query_params.get("status", "").strip()
    if role:
        if role not in ROLES:
            raise ServiceError("VALIDATION", "Confira os campos destacados.", {"role": "Papel inválido."})
        where.append(UserRow.role == role)
    if status:
        if status not in ("active", "disabled"):
            raise ServiceError("VALIDATION", "Confira os campos destacados.", {"status": "Use active ou disabled."})
        where.append(UserRow.disabled_at.is_(None) if status == "active" else UserRow.disabled_at.is_not(None))
    if q:
        where.append(or_(UserRow.name.ilike(_like(q), escape="\\"), UserRow.email.ilike(_like(q), escape="\\")))
    total = db.scalar(select(func.count()).select_from(UserRow).where(*where)) or 0
    rows = db.scalars(
        select(UserRow).where(*where).order_by(UserRow.created_at.desc(), UserRow.id).limit(size).offset((page - 1) * size)
    ).all()
    return _page([admin_user_json(u) for u in rows], total, page, size)


def _other_active_admins(db, user_id: str) -> int:
    return db.scalar(
        select(func.count()).select_from(UserRow).where(
            UserRow.role == "admin", UserRow.deleted_at.is_(None), UserRow.disabled_at.is_(None), UserRow.id != user_id
        )
    ) or 0


@router.patch("/users/{user_id}")
def update_user(
    user_id: str, request: Request, admin: AdminUser, db: DbDep, now: ClockDep, lock: LockDep,
    payload: dict[str, Any] = Body(...),
):
    """Corpo: `role` (student|teacher|external|admin) e/ou `active` (bool). Ninguém altera a si mesmo, e o último
    admin ativo não pode ser rebaixado nem desativado. Desativar revoga todas as sessões na hora."""
    errors: dict[str, str] = {}
    new_role, new_active = payload.get("role"), payload.get("active")
    if "role" in payload and new_role not in ROLES:
        errors["role"] = "Escolha aluno, professor, comunidade externa ou administração."
    if "active" in payload and not isinstance(new_active, bool):
        errors["active"] = "Use verdadeiro ou falso."
    if not errors and "role" not in payload and "active" not in payload:
        errors["_form"] = "Informe role e/ou active."
    if errors:
        raise ServiceError("VALIDATION", "Confira os campos destacados.", errors)
    ip, instant = client_ip(request), now()
    with lock:
        user = db.get(UserRow, user_id)
        if user is None or user.deleted_at is not None:
            raise ServiceError("NOT_FOUND", "Usuário não encontrado.")
        if user.id == admin.id:
            raise ServiceError("CONFLICT", "Você não pode alterar a sua própria conta por aqui.")
        demoting = "role" in payload and user.role == "admin" and new_role != "admin"
        disabling = new_active is False and user.disabled_at is None
        if (demoting or disabling) and user.role == "admin" and user.disabled_at is None and _other_active_admins(db, user.id) == 0:
            raise ServiceError("CONFLICT", "Esta é a última conta de administração ativa. Crie outra antes.")
        if "role" in payload and new_role != user.role:
            audit.record(
                db, instant, audit.ROLE_CHANGE, actor_id=admin.id, target_type="user", target_id=user.id, ip=ip,
                metadata={"from": user.role, "to": new_role}, commit=False,
            )
            user.role = new_role
        if new_active is False and user.disabled_at is None:
            user.disabled_at = instant
            user.token_version += 1  # invalida também os tokens de acesso já emitidos
            revoke_all_sessions(db, user.id, instant)
            audit.record(db, instant, audit.USER_DISABLE, actor_id=admin.id, target_type="user", target_id=user.id, ip=ip, commit=False)
        elif new_active is True and user.disabled_at is not None:
            user.disabled_at = None
            audit.record(db, instant, audit.USER_ENABLE, actor_id=admin.id, target_type="user", target_id=user.id, ip=ip, commit=False)
        db.commit()
    return admin_user_json(user)


# --- convites de administração ----------------------------------------------------------------------------------


def invite_json(i: AdminInviteRow, now: datetime) -> dict[str, Any]:
    if i.used_at is not None:
        status = "accepted"
    elif i.revoked_at is not None:
        status = "revoked"
    elif i.expires_at <= now:
        status = "expired"
    else:
        status = "pending"
    return {
        "id": i.id, "email": i.email, "status": status, "createdAt": to_iso(i.created_at),
        "expiresAt": to_iso(i.expires_at), "invitedById": i.invited_by_id,
    }


@router.post("/invites", status_code=201)
def create_invite(
    request: Request, background: BackgroundTasks, admin: AdminUser, db: DbDep, settings: SettingsDep, now: ClockDep,
    lock: LockDep, mailer: MailerDep, payload: dict[str, Any] = Body(...),
):
    """Gera o link de uso único (48 h) e o envia pelo mailer. O token só existe no e-mail: a API não o devolve."""
    email = validate_email_only(payload)["email"]
    ip, instant = client_ip(request), now()
    with lock:
        if db.scalar(select(UserRow).where(UserRow.email == email)):
            raise ServiceError("EMAIL_TAKEN", "Este e-mail já está cadastrado.", {"email": "Este e-mail já está cadastrado."})
        for old in db.scalars(
            select(AdminInviteRow).where(
                AdminInviteRow.email == email, AdminInviteRow.used_at.is_(None), AdminInviteRow.revoked_at.is_(None)
            )
        ).all():
            old.revoked_at = instant  # um convite aberto por e-mail
        raw = new_opaque_token()
        invite = AdminInviteRow(
            id=random_id("invite"), email=email, token_hash=hash_token(raw), invited_by_id=admin.id,
            created_at=instant, expires_at=instant + timedelta(hours=settings.invite_token_hours),
        )
        db.add(invite)
        audit.record(
            db, instant, audit.INVITE_CREATE, actor_id=admin.id, target_type="invite", target_id=invite.id, ip=ip,
            metadata={"emailRef": audit.email_fingerprint(email)}, commit=False,
        )
        db.commit()
    background.add_task(deliver, mailer, admin_invite_email(settings, email, admin.name, raw))
    return invite_json(invite, instant)


@router.get("/invites")
def list_invites(request: Request, _: AdminUser, db: DbDep, now: ClockDep):
    page, size = _page_params(request)
    total = db.scalar(select(func.count()).select_from(AdminInviteRow)) or 0
    rows = db.scalars(
        select(AdminInviteRow).order_by(AdminInviteRow.created_at.desc(), AdminInviteRow.id).limit(size).offset((page - 1) * size)
    ).all()
    instant = now()
    return _page([invite_json(i, instant) for i in rows], total, page, size)


@router.delete("/invites/{invite_id}", status_code=204)
def revoke_invite(invite_id: str, request: Request, admin: AdminUser, db: DbDep, now: ClockDep, lock: LockDep):
    instant = now()
    with lock:
        invite = db.get(AdminInviteRow, invite_id)
        if invite is None:
            raise ServiceError("NOT_FOUND", "Convite não encontrado.")
        if invite.used_at is not None:
            raise ServiceError("CONFLICT", "Este convite já foi aceito.")
        if invite.revoked_at is None:
            invite.revoked_at = instant
            audit.record(
                db, instant, audit.INVITE_REVOKE, actor_id=admin.id, target_type="invite", target_id=invite.id,
                ip=client_ip(request), commit=False,
            )
            db.commit()
    return Response(status_code=204)
