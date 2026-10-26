"""Configuração por variáveis de ambiente (ver `.env.example`)."""

from __future__ import annotations

import logging
import os
import secrets
from dataclasses import dataclass, field, replace
from datetime import timedelta, timezone, tzinfo
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

log = logging.getLogger("campuslost")

BACKEND_DIR = Path(__file__).resolve().parent.parent
# Chave de desenvolvimento: INSEGURA de propósito e pública. Só vale fora de produção.
DEV_INSECURE_SECRET = "dev-insecure-secret-do-not-use-in-production-0123456789"
DEFAULT_GOOGLE_DOMAINS = ("undb.edu.br",)
MIN_PROD_SECRET_LENGTH = 32


class ConfigError(RuntimeError):
    pass


def _bool(value: str | None, default: bool) -> bool:
    if value is None or value.strip() == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "on", "sim"}


def _int(value: str | None, default: int) -> int:
    try:
        return int(value) if value not in (None, "") else default
    except ValueError:
        return default


def _list(value: str | None, default: tuple[str, ...]) -> tuple[str, ...]:
    items = tuple(p.strip() for p in (value or "").split(",") if p.strip())
    return items or default


@dataclass(frozen=True)
class Settings:
    env: str = "development"
    secret_key: str = field(default=DEV_INSECURE_SECRET, repr=False)
    access_token_expire_minutes: int = 480
    database_url: str = f"sqlite:///{BACKEND_DIR / 'data' / 'campuslost.db'}"
    uploads_dir: Path = BACKEND_DIR / "uploads"
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)
    demo_mode: bool = True
    seed_on_startup: bool = True
    google_client_id: str = ""
    google_allowed_domains: tuple[str, ...] = DEFAULT_GOOGLE_DOMAINS
    timezone_name: str = "America/Fortaleza"
    login_rate_limit: int = 10
    login_rate_window_seconds: int = 60
    max_body_bytes: int = 11 * 1024 * 1024
    bcrypt_rounds: int = 12
    profile_token_minutes: int = 10
    google_tokeninfo_url: str = "https://oauth2.googleapis.com/tokeninfo"
    # Sessões por cookie (B1/6): acesso curto + refresh rotativo.
    cookie_access_minutes: int = 15
    refresh_days: int = 7
    cookie_secure: bool | None = None  # None: Secure em tudo que não for development/test
    # E-mail (B1/3). `console` imprime o link no log (só dev); `smtp` envia de verdade.
    mail_backend: str = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = field(default="", repr=False)
    smtp_from: str = ""
    app_base_url: str = "http://localhost:3000"
    verify_token_hours: int = 24
    reset_token_minutes: int = 60
    email_token_hourly_limit: int = 3  # tokens de e-mail por usuário/finalidade por hora
    # Limite de login persistido (B1/7)
    login_failure_decay_seconds: int = 900
    login_lock_max_seconds: int = 3600
    turnstile_secret: str = field(default="", repr=False)  # vazio = captcha desligado
    # Hostnames aceitos na resposta da Cloudflare (vazio = não confere). Em produção, liste só o(s) domínio(s) do site.
    turnstile_hostnames: tuple[str, ...] = ()
    turnstile_verify_url: str = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    terms_version: str = "2026-10"
    # B2: 2FA obrigatório para administração nas rotas /admin/*. None = automático (exigido, exceto em DEMO_MODE).
    admin_require_2fa: bool | None = None
    invite_token_hours: int = 48
    twofa_challenge_minutes: int = 5
    backup_dir: Path = BACKEND_DIR / "data" / "backups"

    @property
    def enforce_admin_2fa(self) -> bool:
        return self.admin_require_2fa if self.admin_require_2fa is not None else not self.demo_mode

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def use_secure_cookies(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.env not in ("development", "test")

    @property
    def tz(self) -> tzinfo:
        try:
            return ZoneInfo(self.timezone_name)
        except Exception:  # noqa: BLE001 - fuso inválido/ausente: cai em UTC-3
            log.warning("Fuso %s indisponível; usando UTC-03:00.", self.timezone_name)
            return timezone(timedelta(hours=-3))

    def with_overrides(self, **kwargs) -> "Settings":
        return replace(self, **kwargs)


def load_settings(environ: dict[str, str] | None = None, *, read_dotenv: bool = True) -> Settings:
    """Lê o ambiente. Em produção, recusa iniciar sem `SECRET_KEY` forte."""
    if environ is None:
        if read_dotenv:
            load_dotenv(BACKEND_DIR / ".env")
        environ = dict(os.environ)
    env = (environ.get("ENV") or "development").strip().lower()
    production = env == "production"

    secret = (environ.get("SECRET_KEY") or "").strip()
    if production:
        if not secret:
            raise ConfigError("SECRET_KEY é obrigatória quando ENV=production.")
        if len(secret) < MIN_PROD_SECRET_LENGTH:
            raise ConfigError(f"SECRET_KEY deve ter pelo menos {MIN_PROD_SECRET_LENGTH} caracteres em produção.")
    elif not secret:
        secret = DEV_INSECURE_SECRET
        log.warning(
            "SECRET_KEY não definida: usando chave de DESENVOLVIMENTO, insegura. "
            "Defina SECRET_KEY antes de qualquer uso real."
        )

    demo_mode = _bool(environ.get("DEMO_MODE"), default=not production)
    database_url = (environ.get("DATABASE_URL") or "").strip() or Settings.database_url
    uploads = (environ.get("UPLOADS_DIR") or "").strip()
    mail_backend = (environ.get("MAIL_BACKEND") or ("smtp" if production else "console")).strip().lower()
    if mail_backend not in ("console", "smtp"):
        raise ConfigError("MAIL_BACKEND deve ser 'console' ou 'smtp'.")
    smtp_host = (environ.get("SMTP_HOST") or "").strip()
    smtp_from = (environ.get("SMTP_FROM") or "").strip()
    if production and mail_backend == "console":
        raise ConfigError("MAIL_BACKEND=console imprime links de acesso no log e não é permitido em produção.")
    if mail_backend == "smtp" and (not smtp_host or not smtp_from):
        raise ConfigError("MAIL_BACKEND=smtp exige SMTP_HOST e SMTP_FROM.")
    secure_raw = environ.get("COOKIE_SECURE")
    return Settings(
        env=env,
        secret_key=secret,
        access_token_expire_minutes=_int(environ.get("ACCESS_TOKEN_EXPIRE_MINUTES"), 480),
        database_url=database_url,
        uploads_dir=Path(uploads).resolve() if uploads else BACKEND_DIR / "uploads",
        cors_origins=_list(environ.get("CORS_ORIGINS"), ("http://localhost:3000",)),
        demo_mode=demo_mode,
        seed_on_startup=demo_mode,
        google_client_id=(environ.get("GOOGLE_CLIENT_ID") or "").strip(),
        google_allowed_domains=_list(environ.get("GOOGLE_ALLOWED_DOMAINS"), DEFAULT_GOOGLE_DOMAINS),
        timezone_name=(environ.get("APP_TIMEZONE") or "America/Fortaleza").strip(),
        login_rate_limit=_int(environ.get("LOGIN_RATE_LIMIT"), 10),
        login_rate_window_seconds=_int(environ.get("LOGIN_RATE_WINDOW_SECONDS"), 60),
        max_body_bytes=_int(environ.get("MAX_BODY_BYTES"), 11 * 1024 * 1024),
        bcrypt_rounds=_int(environ.get("BCRYPT_ROUNDS"), 12),
        cookie_access_minutes=_int(environ.get("COOKIE_ACCESS_MINUTES"), 15),
        refresh_days=_int(environ.get("REFRESH_DAYS"), 7),
        cookie_secure=None if secure_raw in (None, "") else _bool(secure_raw, True),
        mail_backend=mail_backend,
        smtp_host=smtp_host,
        smtp_port=_int(environ.get("SMTP_PORT"), 587),
        smtp_user=(environ.get("SMTP_USER") or "").strip(),
        smtp_password=environ.get("SMTP_PASSWORD") or "",
        smtp_from=smtp_from,
        app_base_url=(environ.get("APP_BASE_URL") or "http://localhost:3000").strip().rstrip("/"),
        turnstile_secret=(environ.get("TURNSTILE_SECRET") or "").strip(),
        turnstile_hostnames=tuple(
            h.strip().lower() for h in (environ.get("TURNSTILE_HOSTNAMES") or "").split(",") if h.strip()
        ),
        terms_version=(environ.get("TERMS_VERSION") or "2026-10").strip(),
        admin_require_2fa=None if (environ.get("ADMIN_REQUIRE_2FA") or "") == "" else _bool(environ.get("ADMIN_REQUIRE_2FA"), True),
        invite_token_hours=_int(environ.get("INVITE_TOKEN_HOURS"), 48),
        backup_dir=Path(environ["BACKUP_DIR"]).resolve() if (environ.get("BACKUP_DIR") or "").strip() else BACKEND_DIR / "data" / "backups",
    )


def random_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(5)}"
