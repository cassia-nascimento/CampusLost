from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from ..models import ItemRow
from .decision import ALLOW, Decision, deny
from .item_status import is_item_locked
from .permissions import has_capability


def is_visible_in_search(item: ItemRow) -> bool:
    """Devolvidos somem da busca (AC03.2)."""
    return item.status != "returned"


def can_register_item(actor: Any) -> Decision:
    if actor is None:
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if has_capability(actor, "register_item"):
        return ALLOW
    return deny("FORBIDDEN", "Você não tem permissão para registrar itens.")


def _check_mutable(actor: Any, item: ItemRow, capability: str, verb: str) -> Decision:
    if actor is None:
        return deny("UNAUTHENTICATED", "Entre na sua conta para continuar.")
    if not has_capability(actor, capability):
        return deny("FORBIDDEN", f"Somente a administração pode {verb} itens.")
    if is_item_locked(item.status):
        participle = "editados" if verb == "editar" else "excluídos"
        return deny("ITEM_RETURNED", f"Itens devolvidos não podem ser {participle}.")
    return ALLOW


def can_edit_item(actor: Any, item: ItemRow) -> Decision:
    return _check_mutable(actor, item, "edit_item", "editar")


def can_delete_item(actor: Any, item: ItemRow) -> Decision:
    return _check_mutable(actor, item, "delete_item", "excluir")


def filter_items(items: Iterable[ItemRow], filters: dict[str, Any]) -> list[ItemRow]:
    """Filtros combinam entre si (AND). Remove devolvidos. Não ordena."""
    out = []
    for item in items:
        if not is_visible_in_search(item):
            continue
        if filters.get("status") and item.status != filters["status"]:
            continue
        if filters.get("category") and item.category != filters["category"]:
            continue
        if filters.get("location") and item.found_location != filters["location"]:
            continue
        if filters.get("from") and item.found_date < filters["from"]:
            continue
        if filters.get("to") and item.found_date > filters["to"]:
            continue
        out.append(item)
    return out


def sort_items(items: Sequence[ItemRow], sort: str | None = "registered") -> list[ItemRow]:
    """Mais recentes primeiro; desempate pelo outro critério e depois pelo id (asc)."""
    sort = sort or "registered"
    # Ordenação estável em três passadas: da chave menos para a mais significativa.
    out = sorted(items, key=lambda i: i.id)
    if sort == "found":
        out.sort(key=lambda i: i.created_at, reverse=True)
        out.sort(key=lambda i: i.found_date, reverse=True)
    else:
        out.sort(key=lambda i: i.found_date, reverse=True)
        out.sort(key=lambda i: i.created_at, reverse=True)
    return out


def search_items(items: Iterable[ItemRow], filters: dict[str, Any]) -> list[ItemRow]:
    return sort_items(filter_items(items, filters), filters.get("sort"))
