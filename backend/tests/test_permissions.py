"""Permissões por papel em CADA endpoint (SPEC §2). Cada caso roda num banco novo com o seed."""

from __future__ import annotations

import pytest

from tests.conftest import ITEM_FORM, JPEG, login

CLAIM_BODY = {"proofDetails": "Tem um adesivo azul na parte de trás.", "lostWhereWhen": "Biblioteca, ontem de manhã."}

# nome, método, caminho, kwargs, {papel: status esperado}  (papéis: guest, user, external [user com vínculo externo], admin)
CASES = [
    ("catalog", "GET", "/catalog", {}, dict(guest=200, user=200, external=200, admin=200)),
    ("health", "GET", "/health", {}, dict(guest=200, user=200, external=200, admin=200)),
    ("items.list", "GET", "/items", {}, dict(guest=200, user=200, external=200, admin=200)),
    ("items.get", "GET", "/items/item-01", {}, dict(guest=200, user=200, external=200, admin=200)),
    ("items.create", "POST", "/items", dict(data=ITEM_FORM), dict(guest=401, user=201, external=201, admin=201)),
    ("items.update", "PUT", "/items/item-01", dict(data=ITEM_FORM), dict(guest=401, user=403, external=403, admin=200)),
    ("items.delete", "DELETE", "/items/item-01", {}, dict(guest=401, user=403, external=403, admin=204)),
    ("claims.create", "POST", "/items/item-01/claims", dict(json=CLAIM_BODY), dict(guest=401, user=201, external=201, admin=403)),
    ("claims.byItem", "GET", "/items/item-03/claims", {}, dict(guest=401, user=403, external=403, admin=200)),
    ("claims.mine", "GET", "/claims/mine", {}, dict(guest=401, user=200, external=200, admin=403)),
    ("claims.pending", "GET", "/claims/pending", {}, dict(guest=401, user=403, external=403, admin=200)),
    # claim-01 é de Beatriz: nenhum dos perfis de demonstração (Marina/Rafael) a vê, só a administração
    ("claims.get", "GET", "/claims/claim-01", {}, dict(guest=401, user=403, external=403, admin=200)),
    ("claims.accept", "POST", "/claims/claim-01/accept", {}, dict(guest=401, user=403, external=403, admin=200)),
    ("claims.reject", "POST", "/claims/claim-01/reject", {}, dict(guest=401, user=403, external=403, admin=200)),
    ("returns.register", "POST", "/items/item-05/return", {}, dict(guest=401, user=403, external=403, admin=201)),
    ("returns.list", "GET", "/returns", {}, dict(guest=401, user=403, external=403, admin=200)),
]


@pytest.mark.parametrize("role", ["guest", "user", "external", "admin"])
@pytest.mark.parametrize("name, method, path, kwargs, expected", CASES, ids=[c[0] for c in CASES])
def test_role_matrix(client, name, method, path, kwargs, expected, role):
    headers = {} if role == "guest" else login(client, role)
    r = client.request(method, path, headers=headers, **kwargs)
    assert r.status_code == expected[role], f"{name} como {role}: {r.status_code} {r.text}"
    if r.status_code in (401, 403):
        assert r.json()["code"] in {"UNAUTHENTICATED", "FORBIDDEN"}
        assert r.json()["message"]


def test_own_claim_is_visible_to_claimant_only(client):
    marina, rafael = login(client, "student"), login(client, "teacher")
    # claim-06 é de Marina
    assert client.get("/claims/claim-06", headers=marina).status_code == 200
    r = client.get("/claims/claim-06", headers=rafael)
    assert r.status_code == 403
    assert r.json() == {"code": "FORBIDDEN", "message": "Você não tem permissão para ver esta reivindicação."}


def test_claim_get_unknown_is_404(client, student):
    r = client.get("/claims/claim-xx", headers=student)
    assert r.status_code == 404 and r.json() == {"code": "NOT_FOUND", "message": "Reivindicação não encontrada."}


def test_admin_cannot_claim_generic_message(client, admin):
    r = client.post("/items/item-01/claims", json=CLAIM_BODY, headers=admin)
    assert r.json() == {"code": "FORBIDDEN", "message": "Você não tem permissão para realizar esta ação."}


def test_nonadmin_edit_of_missing_item_is_404_like_the_mock(client, student):
    # no mock, o item é procurado ANTES de checar o papel
    r = client.put("/items/item-xx", data=ITEM_FORM, headers=student)
    assert r.status_code == 404
    r = client.delete("/items/item-xx", headers=student)
    assert r.status_code == 404


def test_error_json_shape(client, student):
    r = client.put("/items/item-01", data=ITEM_FORM, headers=student)
    assert r.headers["content-type"].startswith("application/json")
    assert r.json() == {"code": "FORBIDDEN", "message": "Somente a administração pode editar itens."}


def test_logged_item_lists_include_creator_but_only_admin_gets_stored_at(client, student, admin):
    item = client.get("/items", headers=student).json()[0]
    assert "storedAt" not in item and "createdById" in item
    assert "storedAt" in client.get("/items", headers=admin).json()[0]
