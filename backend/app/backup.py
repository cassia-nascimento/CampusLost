"""Backup do SQLite (B2) pela API de backup do `sqlite3` (consistente mesmo com o servidor rodando em WAL).

    python -m app.backup                 # data/backups/campuslost-AAAAMMDD-HHMMSS.db, mantém os 7 mais recentes
    python -m app.backup --keep 14 --dest /var/backups/campuslost

O backup contém TODOS os dados (hashes de senha, segredos TOTP, auditoria): proteja o diretório de destino.
As fotos (`uploads/`) NÃO entram: copie a pasta à parte. Restaurar = parar a API e copiar o arquivo sobre o banco.
"""

from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url

from .clock import utc_now
from .config import Settings, load_settings

PATTERN = re.compile(r"^campuslost-\d{8}-\d{6}\.db$")
DEFAULT_KEEP = 7


class BackupError(RuntimeError):
    pass


def sqlite_path(settings: Settings) -> Path:
    url = make_url(settings.database_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        raise BackupError("O backup só funciona com um banco SQLite em arquivo.")
    return Path(url.database)


def run_backup(settings: Settings, now: datetime, *, dest: Path | None = None, keep: int = DEFAULT_KEEP) -> Path:
    if keep < 1:
        raise BackupError("--keep deve ser pelo menos 1.")
    source = sqlite_path(settings)
    if not source.exists():
        raise BackupError(f"Banco não encontrado: {source}")
    folder = Path(dest) if dest else settings.backup_dir
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"campuslost-{now:%Y%m%d-%H%M%S}.db"
    partial = target.with_suffix(".db.partial")
    src = sqlite3.connect(f"file:{source}?mode=ro", uri=True)
    try:
        dst = sqlite3.connect(partial)
        try:
            src.backup(dst)
        finally:
            dst.close()
    finally:
        src.close()
    partial.replace(target)
    for old in sorted((f for f in folder.iterdir() if PATTERN.match(f.name)), key=lambda f: f.name, reverse=True)[keep:]:
        old.unlink()
    return target


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Copia o SQLite para data/backups/ e mantém só os N mais recentes.")
    p.add_argument("--keep", type=int, default=DEFAULT_KEEP)
    p.add_argument("--dest", type=Path, default=None)
    args = p.parse_args(argv)
    try:
        target = run_backup(load_settings(), utc_now(), dest=args.dest, keep=args.keep)
    except BackupError as exc:
        print(exc, file=sys.stderr)
        return 1
    print(f"Backup criado: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
