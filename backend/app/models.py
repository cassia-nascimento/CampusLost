"""Tabelas (SQLAlchemy 2). Esquema versionado por Alembic (`alembic/`); `create_all` só em dev/testes."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    # Sempre guardado normalizado (trim + minúsculas).
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(16))  # student | teacher | external | admin
    provider: Mapped[str] = mapped_column(String(16), default="password")  # password | google | deleted
    # Nunca serializado. `None` para contas criadas só pelo Google.
    password_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    # `None` = e-mail ainda não confirmado (pode entrar, mas não cadastra item nem reivindica).
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    terms_version: Mapped[str | None] = mapped_column(String(32), nullable=True)
    # Incrementa ao redefinir a senha: invalida todo token de acesso emitido antes (claim `tv`).
    token_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # LGPD: conta anonimizada (a linha fica para preservar a integridade de itens/reivindicações).
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class SessionRow(Base):
    """Sessão de login (cookie e Bearer). Só o hash SHA-256 do refresh token é guardado."""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # Hash do refresh anterior: reapresentá-lo indica roubo/replay e revoga a sessão.
    prev_refresh_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class EmailTokenRow(Base):
    """Token de uso único enviado por e-mail (verificação ou redefinição de senha). Só o hash é guardado."""

    __tablename__ = "email_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(16))  # verify | reset
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class LoginAttemptRow(Base):
    """Falhas de login por (e-mail, IP) com bloqueio progressivo."""

    __tablename__ = "login_attempts"
    __table_args__ = (UniqueConstraint("email", "ip", name="uq_login_attempt_email_ip"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(120))
    ip: Mapped[str] = mapped_column(String(64))
    failures: Mapped[int] = mapped_column(Integer, default=0)
    lock_level: Mapped[int] = mapped_column(Integer, default=0)
    last_failure_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ItemRow(Base):
    __tablename__ = "items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40))
    found_location: Mapped[str] = mapped_column(String(40))
    found_date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    stored_at: Mapped[str] = mapped_column(String(120))
    photo_url: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    created_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class ClaimRow(Base):
    __tablename__ = "claims"
    # Pelo conjunto de regras, um usuário nunca tem duas reivindicações no mesmo item
    # (ativa -> DUPLICATE_CLAIM; recusada -> CLAIM_BLOCKED). A restrição protege contra corrida.
    __table_args__ = (
        UniqueConstraint("item_id", "claimant_id", name="uq_claim_item_claimant"),
        Index("ix_claims_status_created", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    claimant_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    proof_details: Mapped[str] = mapped_column(Text)
    lost_where_when: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16))  # pending | accepted | rejected
    created_at: Mapped[datetime] = mapped_column(DateTime)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ReturnRow(Base):
    __tablename__ = "returns"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("items.id"), unique=True)
    claim_id: Mapped[str] = mapped_column(ForeignKey("claims.id"))
    returned_to_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    registered_by_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    returned_at: Mapped[datetime] = mapped_column(DateTime, index=True)
