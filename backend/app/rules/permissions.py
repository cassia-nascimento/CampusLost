from __future__ import annotations

from typing import Protocol

from .decision import ALLOW, Decision, deny

ALL = ("student", "teacher", "admin")
COMMON = ("student", "teacher")
ADMIN = ("admin",)

# Matriz de permissões por papel (SPEC §2).
PERMISSIONS: dict[str, tuple[str, ...]] = {
    "register_item": ALL,
    "search_items": ALL,
    "claim_item": COMMON,
    "view_own_claims": COMMON,
    "review_claims": ADMIN,
    "edit_item": ADMIN,
    "delete_item": ADMIN,
    "register_return": ADMIN,
    "view_returns": ADMIN,
}

# Visitante (P26): só ver lista e detalhe.
GUEST_CAPABILITIES = ("search_items",)


class HasRole(Protocol):
    role: str


def has_capability(actor: HasRole | None, capability: str) -> bool:
    if actor is None:
        return capability in GUEST_CAPABILITIES
    return actor.role in PERMISSIONS[capability]


def is_admin(actor: HasRole | None) -> bool:
    return actor is not None and actor.role == "admin"


def check_capability(actor: HasRole | None, capability: str) -> Decision:
    if actor is None:
        if has_capability(actor, capability):
            return ALLOW
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if not has_capability(actor, capability):
        return deny("FORBIDDEN", "Você não tem permissão para realizar esta ação.")
    return ALLOW
