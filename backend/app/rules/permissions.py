from __future__ import annotations

from typing import Protocol

from .decision import ALLOW, Decision, deny

ALL = ("user", "admin")
COMMON = ("user",)
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

# Capacidades que exigem e-mail confirmado (contas de senha nascem não verificadas).
REQUIRES_VERIFIED_EMAIL = ("register_item", "claim_item")
EMAIL_NOT_VERIFIED_MESSAGE = "Confirme seu e-mail para continuar. Enviamos um link de confirmação para a sua caixa de entrada."

# Visitante (P26): só ver lista e detalhe.
GUEST_CAPABILITIES = ("search_items",)


class HasRole(Protocol):
    role: str


def has_capability(actor: HasRole | None, capability: str) -> bool:
    if actor is None:
        return capability in GUEST_CAPABILITIES
    return actor.role in PERMISSIONS[capability]


def email_not_verified(actor: HasRole | None) -> Decision | None:
    """`Decision` de negação se o ator existe e ainda não confirmou o e-mail; senão `None`."""
    # `getattr`: regras puras também recebem atores simples (só `role`), tratados como verificados.
    if actor is not None and getattr(actor, "email_verified_at", "ok") is None:
        return deny("EMAIL_NOT_VERIFIED", EMAIL_NOT_VERIFIED_MESSAGE)
    return None


def is_admin(actor: HasRole | None) -> bool:
    return actor is not None and actor.role == "admin"


def check_capability(actor: HasRole | None, capability: str) -> Decision:
    if actor is None:
        if has_capability(actor, capability):
            return ALLOW
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if not has_capability(actor, capability):
        return deny("FORBIDDEN", "Você não tem permissão para realizar esta ação.")
    if capability in REQUIRES_VERIFIED_EMAIL:
        return email_not_verified(actor) or ALLOW
    return ALLOW
