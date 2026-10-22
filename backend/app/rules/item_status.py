from __future__ import annotations

from ..errors import ServiceError

ITEM_STATUS_LABEL = {"available": "Disponível", "under_claim": "Em reivindicação", "returned": "Devolvido"}

# Máquina de estados do item (SPEC §4). Nenhum outro status existe.
ITEM_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "available": ("under_claim",),
    "under_claim": ("returned", "available"),
    "returned": (),
}


def can_transition(src: str, dst: str) -> bool:
    return dst in ITEM_TRANSITIONS[src]


def assert_transition(src: str, dst: str) -> None:
    if not can_transition(src, dst):
        if src == "returned":
            raise ServiceError("ITEM_RETURNED", "Este item já foi devolvido e não pode mais ser alterado.")
        raise ServiceError(
            "INVALID_TRANSITION",
            f'Não é possível mudar o item de "{ITEM_STATUS_LABEL[src]}" para "{ITEM_STATUS_LABEL[dst]}".',
        )


def is_item_locked(status: str) -> bool:
    """Itens devolvidos são somente leitura (P10)."""
    return status == "returned"
