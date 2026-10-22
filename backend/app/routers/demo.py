"""[Somente demonstração] Perfis de entrada rápida e reinício do seed. Só existem com DEMO_MODE=true."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..deps import ClockDep, DbDep, LockDep, SettingsDep, demo_guard
from ..errors import ServiceError
from ..models import UserRow
from ..schemas import user_json
from ..seed import DEMO_PROFILE_IDS, DEMO_PROFILE_LABELS, reset_demo
from .sessions import session_response

router = APIRouter(prefix="/demo", tags=["demo"], dependencies=[Depends(demo_guard)])


@router.get("/profiles")
def demo_profiles(db: DbDep):
    out = []
    for role in ("student", "teacher", "admin"):
        user = db.get(UserRow, DEMO_PROFILE_IDS[role])
        if user is not None:
            out.append({"role": role, "label": DEMO_PROFILE_LABELS[role], "user": user_json(user)})
    return out


@router.post("/login/{role}")
def demo_login(role: str, db: DbDep, settings: SettingsDep):
    if role not in DEMO_PROFILE_IDS:
        raise ServiceError("NOT_FOUND", "Perfil de demonstração não encontrado.")
    user = db.get(UserRow, DEMO_PROFILE_IDS[role])
    if user is None:
        raise ServiceError("NOT_FOUND", "Perfil de demonstração não encontrado. Rode o seed.")
    return session_response(settings, user)


@router.post("/reset", status_code=204)
def demo_reset(db: DbDep, settings: SettingsDep, lock: LockDep, now: ClockDep):
    """Restaura o seed (datas relativas a hoje) e apaga as fotos enviadas. Sem autenticação, como no mock."""
    from fastapi import Response

    with lock:
        reset_demo(db, settings, now())
    return Response(status_code=204)
