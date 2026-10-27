"""Local livre, categoria "Outros" especificada, local de guarda opcional e privacidade do `storedAt`."""

from __future__ import annotations

import pytest

from tests.conftest import ITEM_FORM, JPEG, login, password_login

LONG_LOCATION = "Bloco C, segundo andar, próximo ao laboratório 04"


def post(client, headers, **over):
    return client.post("/items", data={**ITEM_FORM, **over}, headers=headers)


def ids(client, params, headers=None):
    r = client.get("/items", params=params, headers=headers or {})
    assert r.status_code == 200, r.text
    return [i["id"] for i in r.json()]


# ---------- local livre ----------
def test_free_text_location_is_accepted_and_trimmed(client, student):
    r = post(client, student, foundLocation=f"   {LONG_LOCATION}  ")
    assert r.status_code == 201 and r.json()["foundLocation"] == LONG_LOCATION
    assert post(client, student, foundLocation="x" * 120).status_code == 201


def test_blank_or_too_long_location_is_refused(client, student):
    for value, msg in (("", "Informe o local onde foi encontrado."), ("    ", "Informe o local onde foi encontrado."), ("x" * 121, "Use no máximo 120 caracteres.")):
        r = post(client, student, foundLocation=value)
        assert r.status_code == 422 and r.json()["fieldErrors"] == {"foundLocation": msg}


# ---------- categoria "Outros" ----------
def test_other_category_requires_specification(client, student):
    for over in ({"categoryOther": ""}, {"categoryOther": "  "}):
        r = post(client, student, **over)
        assert r.status_code == 422 and r.json()["fieldErrors"] == {"categoryOther": "Especifique a categoria."}
    form = {k: v for k, v in ITEM_FORM.items() if k != "categoryOther"}
    r = client.post("/items", data=form, headers=student)
    assert r.status_code == 422 and r.json()["fieldErrors"] == {"categoryOther": "Especifique a categoria."}


def test_other_category_with_specification_is_saved_and_public(client, student):
    created = post(client, student, categoryOther="  Instrumento musical ").json()
    assert created["category"] == "Outros" and created["categoryOther"] == "Instrumento musical"
    assert client.get(f"/items/{created['id']}").json()["item"]["categoryOther"] == "Instrumento musical"  # visitante
    assert [i for i in client.get("/items").json() if i["id"] == created["id"]][0]["categoryOther"] == "Instrumento musical"


def test_predefined_category_ignores_and_nulls_category_other(client, student, admin):
    created = post(client, student, category="Chaves", categoryOther="Qualquer coisa").json()
    assert created["category"] == "Chaves" and created["categoryOther"] is None
    # mesmo inválido (curto) é ignorado quando a categoria é predefinida
    assert post(client, student, category="Roupas", categoryOther="x").json()["categoryOther"] is None
    # edição: trocar Outros -> predefinida limpa o detalhe
    r = client.put("/items/item-06", data={**ITEM_FORM, "category": "Documentos", "categoryOther": "lixo"}, headers=admin)
    assert r.json()["category"] == "Documentos" and r.json()["categoryOther"] is None
    assert client.get("/items/item-06", headers=admin).json()["item"]["categoryOther"] is None


def test_seed_other_items_have_detail(client):
    by_id = {i["id"]: i for i in client.get("/items").json()}
    assert by_id["item-06"]["categoryOther"] == "Garrafa térmica"
    for item in by_id.values():
        assert (item["categoryOther"] is not None) == (item["category"] == "Outros")


# ---------- local de guarda obrigatório ----------
STORED_REQUIRED = "Informe onde o item está guardado."


def test_stored_at_is_required_on_create(client, student):
    missing = {k: v for k, v in ITEM_FORM.items() if k != "storedAt"}
    for r in (client.post("/items", data=missing, headers=student), post(client, student, storedAt=""), post(client, student, storedAt="    ")):
        assert r.status_code == 422 and r.json()["code"] == "VALIDATION"
        assert r.json()["fieldErrors"] == {"storedAt": STORED_REQUIRED}
    ok = post(client, student, storedAt="  Secretaria  ")
    assert ok.status_code == 201 and "storedAt" not in ok.json()  # o criador comum não recebe de volta


def test_stored_at_is_required_on_update_and_trimmed_for_admin(client, admin):
    missing = {k: v for k, v in ITEM_FORM.items() if k != "storedAt"}
    for data in (missing, {**ITEM_FORM, "storedAt": ""}, {**ITEM_FORM, "storedAt": "   "}):
        r = client.put("/items/item-01", data=data, headers=admin)
        assert r.status_code == 422 and r.json()["fieldErrors"] == {"storedAt": STORED_REQUIRED}
    put = client.put("/items/item-01", data={**ITEM_FORM, "storedAt": "  Secretaria "}, headers=admin)
    assert put.status_code == 200 and put.json()["storedAt"] == "Secretaria"
    assert client.get("/items/item-01", headers=admin).json()["item"]["storedAt"] == "Secretaria"


def test_stored_at_length_is_validated(client, student, admin):
    assert post(client, student, storedAt="ab").json()["fieldErrors"] == {"storedAt": "Use pelo menos 3 caracteres."}
    assert post(client, student, storedAt="x" * 121).json()["fieldErrors"] == {"storedAt": "Use no máximo 120 caracteres."}
    assert post(client, student, storedAt="x" * 120).status_code == 201
    r = client.put("/items/item-01", data={**ITEM_FORM, "storedAt": "ab"}, headers=admin)
    assert r.status_code == 422 and r.json()["fieldErrors"] == {"storedAt": "Use pelo menos 3 caracteres."}


def test_update_validates_new_rules(client, admin):
    r = client.put("/items/item-01", data={**ITEM_FORM, "foundLocation": " ", "categoryOther": ""}, headers=admin)
    assert r.status_code == 422
    assert r.json()["fieldErrors"] == {"foundLocation": "Informe o local onde foi encontrado.", "categoryOther": "Especifique a categoria."}


# ---------- privacidade do storedAt (matriz completa em tests/test_stored_at_privacy.py) ----------
def keys_with_stored_at(value) -> bool:
    if isinstance(value, dict):
        return "storedAt" in value or any(keys_with_stored_at(v) for v in value.values())
    if isinstance(value, list):
        return any(keys_with_stored_at(v) for v in value)
    return False


def test_stored_at_hidden_from_guest_and_ordinary_users_without_accepted_claim(client, student, admin, teacher):
    created = post(client, student)
    assert created.status_code == 201 and "storedAt" not in created.json()  # resposta do POST ao autor comum
    mine_id = created.json()["id"]
    for headers in ({}, teacher):  # visitante; Rafael (pendente no item-03, criador do item-05, aceito só em item devolvido)
        for path in ("/items", "/items/item-03", "/items/item-05", f"/items/{mine_id}"):
            r = client.get(path, headers=headers)
            assert r.status_code == 200 and not keys_with_stored_at(r.json()), (path, headers)
    assert all(not keys_with_stored_at(r) for r in (client.get("/claims/mine", headers=teacher).json(),))
    assert keys_with_stored_at(client.get("/items", headers=admin).json())
    assert keys_with_stored_at(client.get(f"/items/{mine_id}", headers=admin).json())


def test_stored_at_in_me_export_is_not_released_by_authorship(client, student, admin):
    post(client, student)
    export = client.get("/me/export", headers=student)
    assert export.status_code == 200 and export.json()["itemsRegistered"] and not keys_with_stored_at(export.json())
    # admin: itens registrados por ele no export, reivindicações, devoluções e decisões trazem o campo
    assert keys_with_stored_at(client.get("/me/export", headers=admin).json()["itemsRegistered"])
    assert keys_with_stored_at(client.get("/claims/pending", headers=admin).json())
    assert keys_with_stored_at(client.get("/items/item-03/claims", headers=admin).json())
    assert keys_with_stored_at(client.get("/returns", headers=admin).json())
    assert keys_with_stored_at(client.post("/claims/claim-01/accept", headers=admin).json())


def test_stored_at_put_is_admin_only(client, student, admin):
    assert client.put("/items/item-01", data=ITEM_FORM, headers=student).status_code == 403
    assert "storedAt" in client.put("/items/item-01", data=ITEM_FORM, headers=admin).json()


def test_accepted_claimant_gets_stored_at_while_awaiting_return(client):
    h = password_login(client, "marina@demo.test")  # claim-04 aceita (item-05, aguardando devolução)
    body = client.get("/items/item-05", headers=h).json()
    assert body["myClaims"][0]["status"] == "accepted" and body["item"]["status"] == "under_claim"
    assert body["item"]["storedAt"] == "Portaria"


# ---------- busca por local ----------
def test_location_search_contains_ignoring_case_and_accents(client, student):
    post(client, student, foundLocation=LONG_LOCATION)
    assert ids(client, {"location": "cantina"}) == ["item-04", "item-06", "item-09"]
    assert ids(client, {"location": "CANTINA"}) == ["item-04", "item-06", "item-09"]
    assert ids(client, {"location": "bibliot"}) == ["item-01", "item-05"]
    assert len(ids(client, {"location": "LABORATORIO 04"})) == 1  # sem acento, maiúsculas
    assert len(ids(client, {"location": "laboratório"})) == 1
    assert ids(client, {"location": "inexistente"}) == []
    assert ids(client, {"location": "   "}) == ids(client, {})  # vazio é ignorado
    assert ids(client, {"category": "Eletrônicos", "location": "bloco a"}) == ["item-07"]


def test_location_search_with_accented_stored_text(client, student):
    post(client, student, foundLocation="Prédio Anexo – Cantina Nova")
    assert len(ids(client, {"location": "predio anexo"})) == 1
    assert len(ids(client, {"location": "PRÉDIO"})) == 1


# ---------- foto ----------
def test_fake_jpeg_content_type_is_photo_invalid_and_photo_stays_optional(client, student):
    r = client.post("/items", data=ITEM_FORM, files={"photo": ("a.jpg", b"isto nao e imagem", "image/jpeg")}, headers=student)
    assert r.status_code == 422 and r.json()["code"] == "PHOTO_INVALID"
    ok = client.post("/items", data=ITEM_FORM, headers=student)
    assert ok.status_code == 201 and ok.json()["photoUrl"] is None
    assert client.post("/items", data=ITEM_FORM, files={"photo": ("a.jpg", JPEG, "image/jpeg")}, headers=student).status_code == 201
