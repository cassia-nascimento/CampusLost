"""Limite de tentativas de login persistido no banco (B1/7), por (e-mail, IP), com bloqueio progressivo.

- cada FALHA soma 1; ao chegar em `login_rate_limit` falhas, bloqueia por `login_rate_window_seconds * 2^nível`
  (60 s, 2 min, 4 min... até `login_lock_max_seconds`);
- enquanto bloqueado, qualquer tentativa (mesmo com a senha certa) recebe 429 sem checar a senha;
- depois do bloqueio, uma nova falha já bloqueia de novo, um nível acima (progressivo);
- a contagem e o nível zeram após `login_failure_decay_seconds` sem falhas (contados a partir do fim do bloqueio);
  login com sucesso zera tudo;
- sobrevive a reinício e vale entre processos (usa o mesmo banco).

Usa o relógio da aplicação (`now`), não o do sistema, para ser testável.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import Settings
from .errors import ServiceError
from .models import LoginAttemptRow

RETENTION = timedelta(days=1)


def _key(email: str, ip: str | None) -> tuple[str, str]:
    return email.strip().lower()[:120], (ip or "?")[:64]


def _row(db: Session, email: str, ip: str | None) -> LoginAttemptRow | None:
    e, i = _key(email, ip)
    return db.scalar(select(LoginAttemptRow).where(LoginAttemptRow.email == e, LoginAttemptRow.ip == i))


def check_login_allowed(db: Session, email: str, ip: str | None, now: datetime) -> None:
    row = _row(db, email, ip)
    if row is not None and row.locked_until is not None and row.locked_until > now:
        retry = max(1, int((row.locked_until - now).total_seconds()) + 1)
        raise ServiceError(
            "RATE_LIMITED",
            "Muitas tentativas. Aguarde um pouco e tente novamente.",
            headers={"Retry-After": str(retry)},
        )


def register_failure(db: Session, settings: Settings, email: str, ip: str | None, now: datetime) -> None:
    """Chame com o `write_lock` tomado. Faz commit."""
    if settings.login_rate_limit <= 0:
        return
    row = _row(db, email, ip)
    decay = timedelta(seconds=settings.login_failure_decay_seconds)
    if row is None:
        e, i = _key(email, ip)
        row = LoginAttemptRow(email=e, ip=i, failures=0, lock_level=0, last_failure_at=now, locked_until=None)
        db.add(row)
    elif now - max(row.last_failure_at, row.locked_until or row.last_failure_at) > decay:
        row.failures, row.lock_level, row.locked_until = 0, 0, None
    row.failures += 1
    row.last_failure_at = now
    if row.failures >= settings.login_rate_limit:
        seconds = min(settings.login_rate_window_seconds * (2**row.lock_level), settings.login_lock_max_seconds)
        row.locked_until = now + timedelta(seconds=seconds)
        row.lock_level += 1
    db.execute(delete(LoginAttemptRow).where(LoginAttemptRow.last_failure_at < now - RETENTION))
    db.commit()


def register_success(db: Session, email: str, ip: str | None) -> None:
    row = _row(db, email, ip)
    if row is not None:
        db.delete(row)
        db.commit()


def clear_for_email(db: Session, email: str) -> None:
    """Após redefinir a senha por e-mail: quem provou controlar a caixa não fica bloqueado."""
    db.execute(delete(LoginAttemptRow).where(LoginAttemptRow.email == email.strip().lower()))
