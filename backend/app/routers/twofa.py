"""2FA TOTP (B2): configurar, ativar, desativar e concluir o login com o segundo fator."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Request, Response
from sqlalchemy import delete

from .. import audit, login_throttle, totp, twofa_service
from ..deps import ClockDep, CurrentUser, DbDep, LockDep, SettingsDep, client_ip
from ..errors import ServiceError
from ..models import RecoveryCodeRow, UserRow
from ..security import TWOFA_CHALLENGE, decode_token, hash_token, verify_password
from ..session_service import issue_session

router = APIRouter(prefix="/auth/2fa", tags=["2fa"])

BAD_CODE = "Código incorreto ou expirado."
CHALLENGE_EXPIRED = "A verificação expirou. Entre novamente."


def _bad_code_field() -> ServiceError:
    return ServiceError("VALIDATION", "Confira os campos destacados.", {"code": BAD_CODE})


def _guard_attempts(db, user: UserRow, ip: str, now) -> str:
    """Limite de tentativas do segundo fator (mesmo mecanismo do login, chave própria)."""
    key = twofa_service.throttle_key(user)
    login_throttle.check_login_allowed(db, key, ip, now)
    return key


@router.post("/setup")
def setup(user: CurrentUser, db: DbDep, now: ClockDep, lock: LockDep):
    """Gera um segredo novo (ainda inativo até `/enable`). Chamar de novo troca o segredo pendente."""
    if user.totp_enabled_at is not None:
        raise ServiceError("CONFLICT", "A verificação em duas etapas já está ativa.")
    with lock:
        user.totp_secret = totp.new_secret()
        user.totp_last_step = None
        db.commit()
    return {"secret": user.totp_secret, "otpauthUri": totp.otpauth_uri(user.totp_secret, user.email)}


@router.post("/enable")
def enable(
    request: Request, user: CurrentUser, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep,
    payload: dict[str, Any] = Body(...),
):
    """Confere o primeiro código, liga o 2FA e devolve os códigos de recuperação (aparecem só desta vez)."""
    ip, instant = client_ip(request), now()
    if user.totp_enabled_at is not None:
        raise ServiceError("CONFLICT", "A verificação em duas etapas já está ativa.")
    if not user.totp_secret:
        raise ServiceError("CONFLICT", "Gere o segredo primeiro (POST /auth/2fa/setup).")
    key = _guard_attempts(db, user, ip, instant)
    with lock:
        if not twofa_service.check_totp(db, user, payload.get("code"), instant):
            login_throttle.register_failure(db, settings, key, ip, instant)
            audit.record(db, instant, audit.TWOFA_FAILURE, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
                         metadata={"stage": "enable"})
            raise _bad_code_field()
        codes = totp.new_recovery_codes()
        db.execute(delete(RecoveryCodeRow).where(RecoveryCodeRow.user_id == user.id))
        for c in codes:
            db.add(RecoveryCodeRow(user_id=user.id, code_hash=hash_token(c), created_at=instant))
        user.totp_enabled_at = instant
        login_throttle.register_success(db, key, ip)
        audit.record(db, instant, audit.TWOFA_ENABLE, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
                     commit=False)
        db.commit()
    return {"enabled": True, "recoveryCodes": codes}


@router.post("/disable")
def disable(
    request: Request, user: CurrentUser, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep,
    payload: dict[str, Any] = Body(...),
):
    """Exige a senha (se a conta tiver) e um código atual (TOTP ou de recuperação)."""
    ip, instant = client_ip(request), now()
    if user.totp_enabled_at is None:
        raise ServiceError("CONFLICT", "A verificação em duas etapas não está ativa.")
    key = _guard_attempts(db, user, ip, instant)
    with lock:
        password_ok = True
        if user.password_hash is not None:
            pw = payload.get("password")
            password_ok = isinstance(pw, str) and verify_password(pw, user.password_hash, settings.bcrypt_rounds)
        method = twofa_service.check_any(db, user, payload.get("code"), instant) if password_ok else None
        if not password_ok or method is None:
            login_throttle.register_failure(db, settings, key, ip, instant)
            audit.record(db, instant, audit.TWOFA_FAILURE, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
                         metadata={"stage": "disable"})
            raise ServiceError(
                "INVALID_CREDENTIALS", "Senha ou código incorretos. A verificação em duas etapas continua ativa.",
                {"password": "Confira a senha e o código."}, status_code=403,
            )
        user.totp_secret = user.totp_enabled_at = user.totp_last_step = None
        db.execute(delete(RecoveryCodeRow).where(RecoveryCodeRow.user_id == user.id))
        login_throttle.register_success(db, key, ip)
        audit.record(db, instant, audit.TWOFA_DISABLE, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
                     metadata={"with": method}, commit=False)
        db.commit()
    return {"enabled": False}


@router.post("/verify")
def verify(
    request: Request, response: Response, payload: dict[str, Any] = Body(...), *,
    db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep,
):
    """Conclui o login iniciado em `/auth/login` (ou Google): `challengeToken` + `code` (TOTP) ou `recoveryCode`."""
    ip, instant = client_ip(request), now()
    token = payload.get("challengeToken")
    claims = decode_token(settings, token, TWOFA_CHALLENGE) if isinstance(token, str) else None
    user = db.get(UserRow, claims["sub"]) if claims and isinstance(claims.get("sub"), str) else None
    if user is None or user.deleted_at is not None or user.totp_enabled_at is None:
        raise ServiceError("UNAUTHENTICATED", CHALLENGE_EXPIRED)
    key = _guard_attempts(db, user, ip, instant)
    if user.disabled_at is not None:
        raise ServiceError("ACCOUNT_DISABLED", "Esta conta está desativada. Fale com a administração do campus.")
    with lock:
        if payload.get("recoveryCode") is not None:
            method = "recovery" if twofa_service.check_recovery(db, user, payload.get("recoveryCode"), instant) else None
        else:
            method = "totp" if twofa_service.check_totp(db, user, payload.get("code"), instant) else None
        if method is None:
            login_throttle.register_failure(db, settings, key, ip, instant)
            audit.record(db, instant, audit.LOGIN_FAILURE, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
                         metadata={"method": "2fa"})
            raise ServiceError("INVALID_CREDENTIALS", BAD_CODE, {"code": BAD_CODE})
        login_throttle.register_success(db, key, ip)
        audit.record(db, instant, audit.LOGIN_SUCCESS, actor_id=user.id, target_type="user", target_id=user.id, ip=ip,
                     metadata={"method": "2fa", "second": method})
    return issue_session(db, settings, user, instant, response)
