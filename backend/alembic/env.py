"""Ambiente do Alembic. Usa o mesmo engine da aplicação (pragmas do SQLite, `foreign_keys=ON`)."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context

from app.config import load_settings
from app.db import make_engine
from app.models import Base

config = context.config
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _database_url() -> str:
    url = context.get_x_argument(as_dictionary=True).get("url") or config.attributes.get("url")
    return url or load_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(), target_metadata=target_metadata, literal_binds=True,
        dialect_opts={"paramstyle": "named"}, render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = make_engine(load_settings().with_overrides(database_url=_database_url()))
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata,
            render_as_batch=True,  # SQLite não altera tabelas in loco: ALTERs futuros viram "batch"
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
