"""B2/5: limpeza e backup."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta

import pytest
from sqlalchemy import func, select

from app import backup, maintenance
from app.models import AdminInviteRow, AuditLogRow, EmailTokenRow, LoginAttemptRow, RecoveryCodeRow, SessionRow
from tests.admin_helpers import make_user
from tests.conftest import FIXED_NOW


def count(s, model):
    return s.scalar(select(func.count()).select_from(model))


def test_cleanup_removes_only_what_expired(client, app, settings, clock):
    # sessões: uma viva, uma expirada, uma revogada
    client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"})
    client.post("/auth/login", json={"email": "rafael@demo.test", "password": "demonstracao123"})
    client.post("/auth/login", json={"email": "externo@demo.test", "password": "demonstracao123"})
    with app.state.session_factory() as s:
        sessions = s.scalars(select(SessionRow).order_by(SessionRow.created_at, SessionRow.id)).all()
        sessions[0].expires_at = FIXED_NOW - timedelta(minutes=1)
        sessions[1].revoked_at = FIXED_NOW
        s.add_all([
            LoginAttemptRow(email="a@x.com", ip="1", failures=3, lock_level=0, last_failure_at=FIXED_NOW - timedelta(hours=2)),
            LoginAttemptRow(email="b@x.com", ip="1", failures=10, lock_level=1, last_failure_at=FIXED_NOW - timedelta(hours=2),
                            locked_until=FIXED_NOW + timedelta(minutes=5)),
            LoginAttemptRow(email="c@x.com", ip="1", failures=1, lock_level=0, last_failure_at=FIXED_NOW - timedelta(seconds=5)),
            EmailTokenRow(id="e1", user_id="user-marina", purpose="verify", token_hash="a" * 64, created_at=FIXED_NOW, expires_at=FIXED_NOW - timedelta(hours=1)),
            EmailTokenRow(id="e2", user_id="user-marina", purpose="verify", token_hash="b" * 64, created_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(hours=1)),
            AdminInviteRow(id="i1", email="x@x.com", token_hash="c" * 64, created_at=FIXED_NOW - timedelta(days=60), expires_at=FIXED_NOW - timedelta(days=58)),
            AdminInviteRow(id="i2", email="y@x.com", token_hash="d" * 64, created_at=FIXED_NOW - timedelta(days=1), expires_at=FIXED_NOW - timedelta(hours=1)),
            AuditLogRow(at=FIXED_NOW - timedelta(days=400), action="login.success"),
        ])
        s.commit()
        counts = maintenance.run_cleanup(s, settings, FIXED_NOW)
        assert counts["sessions"] == 2 and counts["email_tokens"] >= 1
        assert counts["login_attempts"] == 1 and counts["admin_invites"] == 1
        assert count(s, SessionRow) == 1
        assert {a.email for a in s.scalars(select(LoginAttemptRow)).all()} == {"b@x.com", "c@x.com"}
        assert {i.id for i in s.scalars(select(AdminInviteRow)).all()} == {"i2"}
        assert count(s, AuditLogRow) >= 1 and "audit_log" not in counts  # auditoria preservada por padrão
        again = maintenance.run_cleanup(s, settings, FIXED_NOW)
        assert sum(again.values()) == 0  # idempotente
        old = maintenance.run_cleanup(s, settings, FIXED_NOW, audit_days=365)
        assert old["audit_log"] == 1


def test_cleanup_cli(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'cli.db'}")
    monkeypatch.setenv("SECRET_KEY", "x" * 40)
    monkeypatch.setenv("ENV", "development")
    from app.db import make_engine
    from app.config import load_settings
    from app.models import Base

    Base.metadata.create_all(make_engine(load_settings(read_dotenv=False)))
    assert maintenance.main([]) == 0
    out = capsys.readouterr().out
    assert "sessions: 0 removido(s)" in out


def test_backup_copies_database_and_keeps_last_n(app, settings, tmp_path):
    dest = tmp_path / "bk"
    created = []
    for i in range(4):
        created.append(backup.run_backup(settings, FIXED_NOW + timedelta(minutes=i), dest=dest, keep=2))
    files = sorted(p.name for p in dest.iterdir())
    assert files == [created[2].name, created[3].name]  # só os 2 mais recentes
    con = sqlite3.connect(created[3])
    try:
        assert con.execute("SELECT count(*) FROM users").fetchone()[0] >= 6
        assert con.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    finally:
        con.close()
    assert not list(dest.glob("*.partial"))


def test_backup_keeps_unrelated_files_and_uses_default_dir(app, settings, tmp_path):
    custom = settings.with_overrides(backup_dir=tmp_path / "def")
    (tmp_path / "def").mkdir()
    (tmp_path / "def" / "notas.txt").write_text("não apagar")
    backup.run_backup(custom, FIXED_NOW, keep=1)
    backup.run_backup(custom, FIXED_NOW + timedelta(seconds=1), keep=1)
    names = sorted(p.name for p in (tmp_path / "def").iterdir())
    assert "notas.txt" in names and len([n for n in names if n.endswith(".db")]) == 1


def test_backup_errors(tmp_path, settings):
    with pytest.raises(backup.BackupError):
        backup.run_backup(settings.with_overrides(database_url="sqlite://"), FIXED_NOW)
    with pytest.raises(backup.BackupError):
        backup.run_backup(settings.with_overrides(database_url=f"sqlite:///{tmp_path / 'nao-existe.db'}"), FIXED_NOW)
    with pytest.raises(backup.BackupError):
        backup.run_backup(settings, FIXED_NOW, keep=0)
