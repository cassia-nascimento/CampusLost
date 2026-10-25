"""RF01: cadastro, login, sessão, Google, verificação de e-mail e recuperação de senha."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Body, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from .. import email_tokens, login_throttle
from ..config import random_id
from ..deps import ClockDep, DbDep, LockDep, MailerDep, OptionalUser, SettingsDep, check_csrf, client_ip, require_session
from ..errors import ServiceError
from ..google_auth import GENERIC_FAIL, verify_google_credential
from ..mailer import deliver, reset_email, verification_email
from ..models import ClaimRow, EmailTokenRow, ItemRow, ReturnRow, SessionRow, UserRow
from ..rules.google import is_allowed_google_email, is_well_formed_email
from ..rules.password import password_error, password_strength
from ..rules.validation import (
    normalize_email,
    validate_email_only,
    validate_google_complete,
    validate_signin,
    validate_signup,
)
from ..schemas import account_json
from ..security import ACCESS, GOOGLE_PROFILE, create_profile_token, decode_token, hash_password, hash_token, verify_password
from ..session_service import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    clear_auth_cookies,
    issue_session,
    revoke_all_sessions,
    revoke_session,
    rotate_refresh,
    session_body,
    set_auth_cookies,
)
from ..turnstile import verify_turnstile

log = logging.getLogger("campuslost.auth")
router = APIRouter(prefix="/auth", tags=["auth"])

INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos."
EMAIL_TAKEN_MESSAGE = "Este e-mail já está cadastrado."
INVALID_TOKEN_MESSAGE = "Link inválido ou expirado. Peça um novo."
GENERIC_ACCEPTED = {"status": "accepted", "message": "Se o e-mail estiver cadastrado, enviaremos as instruções em instantes."}
MAIL_IP_LIMIT = 20  # pedidos de e-mail por IP por hora (memória; 1 processo)
STRENGTH_IP_LIMIT = 600  # consultas do medidor de senha por IP por hora


def _email_taken() -> ServiceError:
    return ServiceError("EMAIL_TAKEN", EMAIL_TAKEN_MESSAGE, {"email": EMAIL_TAKEN_MESSAGE})


def _find_by_email(db, email: str) -> UserRow | None:
    return db.scalar(select(UserRow).where(UserRow.email == email))


def _normalize_google_profile(email: str, name: str) -> dict[str, str]:
    """E-mail normalizado; nome aparado, limitado a 80 e, se curto demais, a parte local do e-mail."""
    email = normalize_email(str(email or ""))
    name = str(name or "").strip()[:80].strip()
    if len(name) < 2:
        name = email.split("@")[0]
    return {"email": email, "name": name}


def _mail_ip_limit(request: Request) -> None:
    request.app.state.mail_limiter.hit(f"{client_ip(request)}|mail")


def _opaque_token(payload: Any) -> str:
    token = payload.get("token") if isinstance(payload, dict) else None
    if not isinstance(token, str) or not (16 <= len(token.strip()) <= 200):
        raise ServiceError("INVALID_TOKEN", INVALID_TOKEN_MESSAGE)
    return token.strip()


def _terms_fields(settings, now) -> dict[str, Any]:
    return {"terms_accepted_at": now, "terms_version": settings.terms_version}


# --- cadastro / login -------------------------------------------------------------------------------------------


@router.post("/signup", status_code=201)
def signup(
    request: Request, response: Response, background: BackgroundTasks, payload: dict[str, Any] = Body(...), *,
    db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep, mailer: MailerDep,
):
    verify_turnstile(settings, payload, client_ip(request))
    data = validate_signup(payload)
    pw_hash = hash_password(data["password"], settings.bcrypt_rounds)
    instant = now()
    with lock:
        if _find_by_email(db, data["email"]):
            raise _email_taken()
        # Conta de senha nasce NÃO verificada (mesmo com e-mail institucional): só o link enviado por e-mail prova
        # o controle da caixa de entrada. Sem isso, qualquer um cadastraria o e-mail de outra pessoa.
        user = UserRow(
            id=random_id("user"), name=data["name"], email=data["email"], role=data["role"],
            provider="password", password_hash=pw_hash, created_at=instant, email_verified_at=None,
            **_terms_fields(settings, instant),
        )
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise _email_taken() from None
        token = email_tokens.issue_token(db, settings, user, email_tokens.VERIFY, instant)
    background.add_task(deliver, mailer, verification_email(settings, user.email, user.name, token))
    return issue_session(db, settings, user, instant, response)


@router.post("/login")
def login(
    request: Request, response: Response, payload: dict[str, Any] = Body(...), *,
    db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep,
):
    raw_email = payload.get("email")
    key_email = raw_email.strip().lower() if isinstance(raw_email, str) else ""
    ip = client_ip(request)
    instant = now()
    login_throttle.check_login_allowed(db, key_email, ip, instant)
    verify_turnstile(settings, payload, ip)

    data = validate_signin(payload)
    user = _find_by_email(db, data["email"])
    # Sempre roda um bcrypt (mesmo sem conta ou para conta só-Google): erro único, sem revelar qual.
    ok = verify_password(data["password"], user.password_hash if user else None, settings.bcrypt_rounds)
    if user is None or not ok or user.deleted_at is not None:
        with lock:
            login_throttle.register_failure(db, settings, data["email"], ip, instant)
        raise ServiceError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE)
    with lock:
        login_throttle.register_success(db, data["email"], ip)
    return issue_session(db, settings, user, instant, response)


@router.get("/me")
def me(actor: OptionalUser):
    """Sessão atual. Sem token (ou token inválido): 401 — o cliente trata como "sem sessão"."""
    return account_json(require_session(actor))


@router.post("/password-strength")
def password_strength_check(request: Request, payload: dict[str, Any] = Body(...)):
    """Regra de senha reutilizável pela interface (medidor). Não grava nada e não loga a senha."""
    request.app.state.strength_limiter.hit(f"{client_ip(request)}|strength")
    return password_strength(payload.get("password"), email=payload.get("email"), name=payload.get("name"))


# --- sessões por cookie -----------------------------------------------------------------------------------------


@router.post("/refresh")
def refresh(request: Request, response: Response, *, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep):
    """Troca o cookie `cl_refresh` por um novo par de cookies (refresh rotativo, uso único)."""
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise ServiceError("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.")
    check_csrf(request, settings)
    with lock:
        sess, user, new_raw = rotate_refresh(db, settings, raw, now())
    set_auth_cookies(response, settings, user, sess, new_raw)
    return session_body(settings, user, sess)


@router.post("/logout", status_code=204)
def logout(request: Request, *, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep):
    """Revoga a sessão atual (Bearer e cookies morrem juntos) e limpa os cookies. Sempre 204."""
    has_bearer = request.headers.get("authorization") is not None
    cookie_access = request.cookies.get(ACCESS_COOKIE)
    cookie_refresh = request.cookies.get(REFRESH_COOKIE)
    if not has_bearer and (cookie_access or cookie_refresh):
        check_csrf(request, settings)
    sessions: dict[str, SessionRow] = {}
    candidates: list[str] = []
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        claims = decode_token(settings, header[7:].strip(), ACCESS)
        if claims and claims.get("sid"):
            candidates.append(claims["sid"])
    if cookie_access:
        claims = decode_token(settings, cookie_access, ACCESS)
        if claims and claims.get("sid"):
            candidates.append(claims["sid"])
    with lock:
        for sid in candidates:
            sess = db.get(SessionRow, sid)
            if sess:
                sessions[sess.id] = sess
        if cookie_refresh:
            sess = db.scalar(select(SessionRow).where(SessionRow.refresh_hash == hash_token(cookie_refresh)))
            if sess:
                sessions[sess.id] = sess
        for sess in sessions.values():
            revoke_session(db, sess, now())
    out = Response(status_code=204)
    clear_auth_cookies(out, settings)
    return out


# --- verificação de e-mail --------------------------------------------------------------------------------------


@router.post("/verify-email")
def verify_email(payload: dict[str, Any] = Body(...), *, db: DbDep, now: ClockDep, lock: LockDep):
    token = _opaque_token(payload)
    instant = now()
    with lock:
        row = email_tokens.find_valid(db, token, email_tokens.VERIFY, instant)
        if row is None or not email_tokens.consume(db, row, instant):
            raise ServiceError("INVALID_TOKEN", INVALID_TOKEN_MESSAGE)
        user = db.get(UserRow, row.user_id)
        if user is None or user.deleted_at is not None:
            db.rollback()
            raise ServiceError("INVALID_TOKEN", INVALID_TOKEN_MESSAGE)
        if user.email_verified_at is None:
            user.email_verified_at = instant
        db.commit()
    return {"verified": True}


@router.post("/resend-verification", status_code=202)
def resend_verification(
    request: Request, background: BackgroundTasks, actor: OptionalUser, payload: dict[str, Any] = Body(default_factory=dict), *,
    db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep, mailer: MailerDep,
):
    """Reenvia o link. Resposta sempre igual (não revela se o e-mail existe), com limite por IP e por conta.
    Logado, o corpo pode ser vazio (usa o e-mail da sessão)."""
    _mail_ip_limit(request)
    verify_turnstile(settings, payload, client_ip(request))
    email = actor.email if actor is not None and "email" not in payload else validate_email_only(payload)["email"]
    instant = now()
    with lock:
        user = _find_by_email(db, email)
        if (
            user is not None and user.deleted_at is None and user.email_verified_at is None
            and not email_tokens.recently_issued(db, settings, user, email_tokens.VERIFY, instant)
        ):
            token = email_tokens.issue_token(db, settings, user, email_tokens.VERIFY, instant)
            background.add_task(deliver, mailer, verification_email(settings, user.email, user.name, token))
    return GENERIC_ACCEPTED


# --- recuperação de senha ---------------------------------------------------------------------------------------


@router.post("/forgot-password", status_code=202)
def forgot_password(
    request: Request, background: BackgroundTasks, payload: dict[str, Any] = Body(...), *,
    db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep, mailer: MailerDep,
):
    _mail_ip_limit(request)
    verify_turnstile(settings, payload, client_ip(request))
    email = validate_email_only(payload)["email"]
    instant = now()
    with lock:
        user = _find_by_email(db, email)
        if (
            user is not None and user.deleted_at is None
            and not email_tokens.recently_issued(db, settings, user, email_tokens.RESET, instant)
        ):
            token = email_tokens.issue_token(db, settings, user, email_tokens.RESET, instant)
            background.add_task(deliver, mailer, reset_email(settings, user.email, user.name, token))
    return GENERIC_ACCEPTED


@router.post("/reset-password")
def reset_password(payload: dict[str, Any] = Body(...), *, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep):
    """Define a senha nova com o token do e-mail. Invalida TODAS as sessões e tokens de acesso anteriores
    (Bearer inclusive). Quem prova controlar a caixa de entrada também fica com o e-mail verificado."""
    token = _opaque_token(payload)
    instant = now()
    row = email_tokens.find_valid(db, token, email_tokens.RESET, instant)
    user = db.get(UserRow, row.user_id) if row else None
    if row is None or user is None or user.deleted_at is not None:
        raise ServiceError("INVALID_TOKEN", INVALID_TOKEN_MESSAGE)
    error = password_error(payload.get("password"), email=user.email, name=user.name)
    if error:  # o token NÃO é gasto: a pessoa pode tentar de novo
        raise ServiceError("VALIDATION", "Confira os campos destacados.", {"password": error})
    pw_hash = hash_password(payload["password"], settings.bcrypt_rounds)
    with lock:
        if not email_tokens.consume(db, row, instant):
            db.rollback()
            raise ServiceError("INVALID_TOKEN", INVALID_TOKEN_MESSAGE)
        user.password_hash = pw_hash
        user.token_version += 1
        if user.email_verified_at is None:
            user.email_verified_at = instant
        revoke_all_sessions(db, user.id, instant)
        db.execute(
            EmailTokenRow.__table__.update()
            .where(EmailTokenRow.user_id == user.id, EmailTokenRow.used_at.is_(None))
            .values(used_at=instant)
        )
        login_throttle.clear_for_email(db, user.email)
        db.commit()
    return {"status": "ok", "message": "Senha redefinida. Entre com a nova senha."}


# --- Google -----------------------------------------------------------------------------------------------------


def _release_unverified_account(db, user: UserRow, now) -> None:
    """Anti pre-hijack. Alguém cadastrou por senha o e-mail de outra pessoa e nunca o confirmou; a dona agora
    prova o e-mail pelo Google. Escolha: a conta de senha NÃO verificada é descartada (senha e sessões do
    cadastro falso morrem) e a dona segue o fluxo normal de conta nova. Uma conta não verificada não pode
    ter itens nem reivindicações; se houver (não deveria), ela é convertida em conta Google verificada."""
    has_data = db.scalar(
        select(func.count()).select_from(ItemRow).where(ItemRow.created_by_id == user.id)
    ) or db.scalar(select(func.count()).select_from(ClaimRow).where(ClaimRow.claimant_id == user.id)) or db.scalar(
        select(func.count()).select_from(ReturnRow).where(
            (ReturnRow.returned_to_id == user.id) | (ReturnRow.registered_by_id == user.id)
        )
    )
    if has_data:
        user.provider, user.password_hash, user.email_verified_at = "google", None, now
        user.token_version += 1
        revoke_all_sessions(db, user.id, now)
        db.execute(delete(EmailTokenRow).where(EmailTokenRow.user_id == user.id))
        db.commit()
        return
    db.execute(delete(SessionRow).where(SessionRow.user_id == user.id))
    db.execute(delete(EmailTokenRow).where(EmailTokenRow.user_id == user.id))
    db.delete(user)
    db.commit()


def _new_google_user(settings, profile: dict[str, str], role: str, now) -> UserRow:
    return UserRow(
        id=random_id("user"), name=profile["name"], email=profile["email"], role=role, provider="google",
        password_hash=None, created_at=now, email_verified_at=now, **_terms_fields(settings, now),
    )


def _commit_new_user(db, user: UserRow) -> None:
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _email_taken() from None


@router.post("/google")
def google_sign_in(
    response: Response, payload: dict[str, Any] = Body(...), *, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep
):
    credential = payload.get("credential")
    if not isinstance(credential, str) or not credential.strip() or len(credential) > 8192:
        raise ServiceError("VALIDATION", "Confira os campos destacados.", {"credential": "Credencial do Google ausente."})
    verified = verify_google_credential(settings, credential.strip())  # exige email_verified == true
    profile = _normalize_google_profile(verified["email"], verified["name"])
    if not is_well_formed_email(profile["email"]):
        raise ServiceError("UNAUTHENTICATED", GENERIC_FAIL)
    institutional = is_allowed_google_email(profile["email"], settings.google_allowed_domains)
    instant = now()
    with lock:
        user = _find_by_email(db, profile["email"])
        if user is not None and user.provider == "password" and user.email_verified_at is None:
            _release_unverified_account(db, user, instant)
            user = None
        if user is not None:
            if user.deleted_at is not None:  # nunca ocorre (e-mail anonimizado), por segurança
                raise ServiceError("UNAUTHENTICATED", GENERIC_FAIL)
            if user.email_verified_at is None:
                user.email_verified_at = instant
                db.commit()
            return {"status": "signed_in", **issue_session(db, settings, user, instant, response)}
        profile_token = create_profile_token(settings, profile["email"], profile["name"])
        if institutional:
            return {"status": "needs_role", "profile": profile, "profileToken": profile_token}
        # Qualquer outro e-mail Google verificado vira comunidade externa. Sem aceite dos termos na chamada
        # não se cria conta: o cliente mostra os termos e repete a chamada com `acceptTerms: true`.
        if payload.get("acceptTerms") is not True:
            return {"status": "needs_terms", "profile": profile, "profileToken": profile_token}
        user = _new_google_user(settings, profile, "external", instant)
        _commit_new_user(db, user)
    return {"status": "signed_in", **issue_session(db, settings, user, instant, response)}


@router.post("/google/complete", status_code=201)
def google_complete(
    response: Response, payload: dict[str, Any] = Body(...), *, db: DbDep, settings: SettingsDep, now: ClockDep, lock: LockDep
):
    token = payload.get("profileToken")
    claims = decode_token(settings, token, GOOGLE_PROFILE) if isinstance(token, str) else None
    if not claims or not isinstance(claims.get("email"), str):
        raise ServiceError("UNAUTHENTICATED", "Sua verificação do Google expirou. Entre com o Google novamente.")
    profile = _normalize_google_profile(claims["email"], claims.get("name", ""))
    institutional = is_allowed_google_email(profile["email"], settings.google_allowed_domains)
    data = validate_google_complete(payload, needs_role=institutional)
    role = data["role"] if institutional else "external"
    instant = now()
    with lock:
        if _find_by_email(db, profile["email"]):
            raise _email_taken()
        user = _new_google_user(settings, profile, role, instant)
        _commit_new_user(db, user)
    return issue_session(db, settings, user, instant, response)
