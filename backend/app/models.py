"""Tabelas (SQLAlchemy 2). Criadas com `create_all`, sem Alembic."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UserRow(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    # Sempre guardado normalizado (trim + minúsculas).
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(16))  # student | teacher | admin
    provider: Mapped[str] = mapped_column(String(16), default="password")  # password | google
    # Nunca serializado. `None` para contas criadas só pelo Google.
    password_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)


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
