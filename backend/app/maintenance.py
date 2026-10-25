"""Rotina de limpeza (B2): remove o que já expirou. Segura para rodar a qualquer hora (cron/systemd timer).

    python -m app.maintenance                      # limpa e imprime quantas linhas removeu por tabela
    python -m app.maintenance --audit-days 365     # também apaga auditoria com mais de 365 dias (padrão: nunca)

Apaga: sessões expiradas ou revogadas, tokens de e-mail expirados ou usados, tentativas de login sem bloqueio
ativo e sem falha recente, convites expirados/revogados há mais de 30 dias e códigos de recuperação usados
há mais de 30 dias. Não toca em usuários, itens, reivindicações nem (por padrão) na auditoria.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta

from sqlalchemy import delete, or_
from sqlalchemy.orm import Session

from .clock import utc_now
from .config import Settings, load_settings
from .db import make_engine, make_session_factory
from .models import AdminInviteRow, AuditLogRow, EmailTokenRow, LoginAttemptRow, RecoveryCodeRow, SessionRow

KEEP_DAYS = 30


def run_cleanup(db: Session, settings: Settings, now: datetime, *, audit_days: int | None = None) -> dict[str, int]:
    keep = now - timedelta(days=KEEP_DAYS)
    decay = now - timedelta(seconds=settings.login_failure_decay_seconds)
    counts = {
        "sessions": db.execute(
            delete(SessionRow).where(or_(SessionRow.expires_at <= now, SessionRow.revoked_at.is_not(None)))
        ).rowcount,
        "email_tokens": db.execute(
            delete(EmailTokenRow).where(or_(EmailTokenRow.expires_at <= now, EmailTokenRow.used_at.is_not(None)))
        ).rowcount,
        "login_attempts": db.execute(
            delete(LoginAttemptRow).where(
                LoginAttemptRow.last_failure_at < decay,
                or_(LoginAttemptRow.locked_until.is_(None), LoginAttemptRow.locked_until <= now),
            )
        ).rowcount,
        "admin_invites": db.execute(
            delete(AdminInviteRow).where(
                or_(AdminInviteRow.expires_at <= keep, AdminInviteRow.revoked_at <= keep, AdminInviteRow.used_at <= keep)
            )
        ).rowcount,
        "recovery_codes": db.execute(delete(RecoveryCodeRow).where(RecoveryCodeRow.used_at <= keep)).rowcount,
    }
    if audit_days is not None and audit_days > 0:
        counts["audit_log"] = db.execute(
            delete(AuditLogRow).where(AuditLogRow.at < now - timedelta(days=audit_days))
        ).rowcount
    db.commit()
    return counts


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Apaga sessões, tokens e tentativas de login expirados.")
    p.add_argument("--audit-days", type=int, default=None, help="apaga auditoria mais antiga que N dias (padrão: mantém tudo)")
    args = p.parse_args(argv)
    settings = load_settings()
    engine = make_engine(settings)
    with make_session_factory(engine)() as db:
        counts = run_cleanup(db, settings, utc_now(), audit_days=args.audit_days)
    for table, n in counts.items():
        print(f"{table}: {n} removido(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
