"""Engine SQLite, sessões e pragmas (foreign_keys=ON, WAL)."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings


def make_engine(settings: Settings) -> Engine:
    url = make_url(settings.database_url)
    is_sqlite = url.get_backend_name() == "sqlite"
    in_memory = is_sqlite and (url.database in (None, "", ":memory:"))
    if is_sqlite and not in_memory:
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)

    kwargs: dict = {}
    if is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False, "timeout": 15}
        if in_memory:
            from sqlalchemy.pool import StaticPool

            kwargs["poolclass"] = StaticPool
    engine = create_engine(url, **kwargs)

    if is_sqlite:

        @event.listens_for(engine, "connect")
        def _pragmas(dbapi_conn, _record):  # noqa: ANN001
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            if not in_memory:
                cur.execute("PRAGMA journal_mode=WAL")
                cur.execute("PRAGMA synchronous=NORMAL")
            cur.close()

    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
