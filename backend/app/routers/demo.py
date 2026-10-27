"""[Somente demonstração] Perfis de entrada rápida e reinício do seed. Só existem com DEMO_MODE=true."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from ..deps import ClockDep, DbDep, LockDep, SettingsDep, demo_guard
from ..errors import ServiceError
from ..models import UserRow
from ..schemas import user_json
from ..seed import DEMO_PROFILE_IDS, DEMO_PROFILE_LABELS, reset_demo
from ..session_service import issue_session

router = APIRouter(prefix="/demo", tags=["demo"], dependencies=[Depends(demo_guard)])


@router.get("/profiles")
def demo_profiles(db: DbDep):
    out = []
    for key in DEMO_PROFILE_IDS:
        user = db.get(UserRow, DEMO_PROFILE_IDS[key])
        if user is not None:
            out.append({"key": key, "label": DEMO_PROFILE_LABELS[key], "user": user_json(user)})
    return out


@router.post("/login/{key}")
def demo_login(key: str, response: Response, db: DbDep, settings: SettingsDep, now: ClockDep):
    if key not in DEMO_PROFILE_IDS:
        raise ServiceError("NOT_FOUND", "Perfil de demonstração não encontrado.")
    user = db.get(UserRow, DEMO_PROFILE_IDS[key])
    if user is None:
        raise ServiceError("NOT_FOUND", "Perfil de demonstração não encontrado. Rode o seed.")
    return issue_session(db, settings, user, now(), response)


@router.post("/reset", status_code=204)
def demo_reset(db: DbDep, settings: SettingsDep, lock: LockDep, now: ClockDep):
    """Restaura o seed (datas relativas a hoje) e apaga as fotos enviadas. Sem autenticação, como no mock."""
    with lock:
        reset_demo(db, settings, now())
    return Response(status_code=204)
