"""P26 / AC03.1: o visitante nunca recebe dado de terceiros nem devolvidos."""

from __future__ import annotations

import json

FORBIDDEN_KEYS = {"storedAt", "createdBy", "createdById", "claimant", "claimantId", "proofDetails", "lostWhereWhen", "returnedToId", "registeredById"}


def keys_deep(value) -> set[str]:
    out: set[str] = set()
    if isinstance(value, dict):
        for k, v in value.items():
            out.add(k)
            out |= keys_deep(v)
    elif isinstance(value, list):
        for v in value:
            out |= keys_deep(v)
    return out


def test_guest_list_has_no_private_fields(client):
    r = client.get("/items")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 9  # 11 do seed menos 2 devolvidos
    assert not (keys_deep(items) & FORBIDDEN_KEYS)
    for item in items:
        assert set(item) == {"id", "title", "description", "category", "foundLocation", "foundDate", "photoUrl", "status", "createdAt"}
    # valores sensíveis do seed não aparecem em lugar nenhum do texto
    for secret in ("user-lucas", "user-beatriz", "user-admin", "user-rafael", "Entregue ao dono", "fita branca"):
        assert secret not in r.text, secret


def test_guest_detail_has_no_private_fields_for_any_item(client):
    for n in (1, 2, 3, 4, 5, 6, 7, 8, 9):
        r = client.get(f"/items/item-0{n}")
        assert r.status_code == 200, n
        body = r.json()
        assert not (keys_deep(body["item"]) & FORBIDDEN_KEYS)
        assert body["createdBy"] is None
        assert body["myClaims"] == [] and body["claims"] == [] and body["returnRecord"] is None
        # `createdBy` existe no contrato, mas SEMPRE null para o visitante
        text = json.dumps({k: v for k, v in body.items() if k != "createdBy"})
        for k in FORBIDDEN_KEYS:
            assert f'"{k}"' not in text
        for secret in ("user-lucas", "user-beatriz", "Lucas", "Beatriz", "demo.test"):
            assert secret not in json.dumps(body), secret


def test_guest_viewer_permissions_are_denied_as_unauthenticated(client):
    v = client.get("/items/item-03").json()["viewer"]
    assert v["claim"] == {"allowed": False, "code": "UNAUTHENTICATED", "message": "Entre para reivindicar este item."}
    for key in ("edit", "delete", "registerReturn"):
        assert v[key] == {"allowed": False, "code": "UNAUTHENTICATED", "message": "Entre na sua conta para continuar."}


def test_returned_item_is_404_for_guest_but_visible_to_logged(client, student, admin):
    for item_id in ("item-10", "item-11"):
        r = client.get(f"/items/{item_id}")
        assert r.status_code == 404
        assert r.json() == {"code": "NOT_FOUND", "message": "Item não encontrado."}
        # mesmo erro de um item que não existe
        assert client.get("/items/item-nao-existe").json() == r.json()
        assert client.get(f"/items/{item_id}", headers=student).status_code == 200
    assert client.get("/items/item-10", headers=admin).json()["returnRecord"]["id"] == "return-01"


def test_returned_items_never_listed(client, student, admin):
    for headers in ({}, student, admin):
        ids = [i["id"] for i in client.get("/items", headers=headers).json()]
        assert "item-10" not in ids and "item-11" not in ids


def test_logged_user_sees_stored_at_and_creator_but_no_foreign_claims(client, student):
    body = client.get("/items/item-03", headers=student).json()
    assert body["item"]["storedAt"] == "Portaria" and body["item"]["createdById"] == "user-lucas"
    assert body["createdBy"] == {"id": "user-lucas", "name": "Lucas Prado", "role": "user"}  # sem e-mail
    assert body["claims"] == [] and body["returnRecord"] is None
    assert body["myClaims"] == []  # claim-01/02 são de Beatriz e Rafael


def test_my_claims_only_returns_own(client, student):
    body = client.get("/items/item-07", headers=student).json()  # claim-06 Marina; claim-07 Beatriz
    assert [c["id"] for c in body["myClaims"]] == ["claim-06"]
    assert body["claims"] == []
    # o motivo do bloqueio é explicado sem revelar quem reivindicou
    assert body["viewer"]["claim"]["code"] == "DUPLICATE_CLAIM"


def test_admin_detail_has_all_claims_and_return_record(client, admin):
    body = client.get("/items/item-03", headers=admin).json()
    assert [c["id"] for c in body["claims"]] == ["claim-01", "claim-02"]  # mais antigas primeiro
    assert body["claims"][0]["claimant"]["email"] == "beatriz@demo.test"
    assert body["myClaims"] == []
    done = client.get("/items/item-11", headers=admin).json()
    assert done["returnRecord"]["returnedToId"] == "user-rafael"


def test_guest_cannot_reach_private_endpoints(client):
    for path in ("/claims/mine", "/claims/pending", "/claims/claim-01", "/items/item-03/claims", "/returns"):
        r = client.get(path)
        assert r.status_code == 401, path


def test_unknown_item_for_guest_is_404(client):
    assert client.get("/items/item-xx").status_code == 404
