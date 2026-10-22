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
    secret_key: str = DEV_INSECURE_SECRET
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

    @property
    def is_production(self) -> bool:
        return self.env == "production"

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
    )


def random_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(5)}"
