"""Fotos em disco: nome gerado (uuid), pasta `uploads/`, servidas em `/uploads/<arquivo>`."""

from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path

from .config import Settings

log = logging.getLogger("campuslost.photos")

URL_PREFIX = "/uploads/"
SEED_PREFIX = "/uploads/seed/"
SEED_EXTENSIONS = {".svg", ".webp"}
SEED_ASSETS_DIR = Path(__file__).resolve().parent / "seed_assets"


def save_photo(settings: Settings, data: bytes, ext: str) -> str:
    """Grava a foto com nome aleatório e devolve o `photoUrl` (`/uploads/<uuid>.<ext>`)."""
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (settings.uploads_dir / name).write_bytes(data)
    return f"{URL_PREFIX}{name}"


def delete_photo_file(settings: Settings, photo_url: str | None) -> None:
    """Remove o arquivo de uma foto ENVIADA. Nunca toca nas imagens do seed nem fora de `uploads/`."""
    if not photo_url or not photo_url.startswith(URL_PREFIX) or photo_url.startswith(SEED_PREFIX):
        return
    root = settings.uploads_dir.resolve()
    target = (root / photo_url[len(URL_PREFIX) :]).resolve()
    if target.parent != root:
        return
    try:
        target.unlink(missing_ok=True)
    except OSError:
        log.warning("Não foi possível remover %s", target.name)


def install_seed_images(settings: Settings) -> None:
    """Copia as imagens do seed (svg e webp) para `uploads/seed/`."""
    dest = settings.uploads_dir / "seed"
    dest.mkdir(parents=True, exist_ok=True)
    for asset in SEED_ASSETS_DIR.iterdir():
        if asset.suffix in SEED_EXTENSIONS:
            shutil.copyfile(asset, dest / asset.name)


def purge_uploaded_photos(settings: Settings) -> None:
    """Apaga as fotos enviadas (mantém `uploads/seed/`). Usado ao reiniciar a demonstração."""
    root = settings.uploads_dir
    if not root.exists():
        return
    for f in root.iterdir():
        if f.is_file():
            f.unlink(missing_ok=True)
