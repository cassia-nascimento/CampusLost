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


# ---------- local de guarda opcional ----------
def test_stored_at_is_optional_on_create_and_admin_fills_it_later(client, student, admin):
    form = {k: v for k, v in ITEM_FORM.items() if k != "storedAt"}
    r = client.post("/items", data=form, headers=student)
    assert r.status_code == 201
    iid = r.json()["id"]
    assert client.get(f"/items/{iid}", headers=admin).json()["item"]["storedAt"] is None
    assert post(client, student, storedAt="   ").status_code == 201
    put = client.put(f"/items/{iid}", data={**ITEM_FORM, "storedAt": "Secretaria"}, headers=admin)
    assert put.status_code == 200 and put.json()["storedAt"] == "Secretaria"
    cleared = client.put(f"/items/{iid}", data={**ITEM_FORM, "storedAt": ""}, headers=admin)
    assert cleared.json()["storedAt"] is None


def test_stored_at_when_present_is_validated(client, student):
    assert post(client, student, storedAt="ab").json()["fieldErrors"] == {"storedAt": "Use pelo menos 3 caracteres."}


def test_update_validates_new_rules(client, admin):
    r = client.put("/items/item-01", data={**ITEM_FORM, "foundLocation": " ", "categoryOther": ""}, headers=admin)
    assert r.status_code == 422
    assert r.json()["fieldErrors"] == {"foundLocation": "Informe o local onde foi encontrado.", "categoryOther": "Especifique a categoria."}


# ---------- privacidade do storedAt ----------
def keys_with_stored_at(value) -> bool:
    if isinstance(value, dict):
        return "storedAt" in value or any(keys_with_stored_at(v) for v in value.values())
    if isinstance(value, list):
        return any(keys_with_stored_at(v) for v in value)
    return False


def test_stored_at_visible_only_to_admin_everywhere(client, student, admin, teacher):
    # Marina: registra um item (autor) e tem reivindicações (claim-04 ACEITA no item-05; claim-06 pendente no item-07)
    created = post(client, student)
    assert created.status_code == 201 and "storedAt" not in created.json()  # resposta do POST ao autor comum
    mine_id = created.json()["id"]

    teacher_headers, admin_headers = teacher, admin

    def check(headers, expected: bool) -> None:
        responses = [
            client.get("/items", headers=headers),
            client.get("/items/item-03", headers=headers),
            client.get("/items/item-05", headers=headers),  # item com reivindicação aceita da Marina
            client.get(f"/items/{mine_id}", headers=headers),
        ]
        if headers:
            if headers is not admin_headers:  # administração não tem "minhas reivindicações"
                responses.append(client.get("/claims/mine", headers=headers))
            if headers is not teacher_headers:  # claim-04 é da Marina: o outro usuário comum leva 403
                responses.append(client.get("/claims/claim-04", headers=headers))
        for r in responses:
            assert r.status_code == 200, (r.request.url, r.text)
            assert keys_with_stored_at(r.json()) is expected, r.request.url

    check({}, False)
    check(student, False)
    check(teacher, False)
    check(admin, True)


def test_stored_at_hidden_in_me_export_and_claims_for_regular_users(client, student, admin):
    post(client, student)
    export = client.get("/me/export", headers=student)
    assert export.status_code == 200 and export.json()["itemsRegistered"] and not keys_with_stored_at(export.json())
    mine = client.get("/claims/mine", headers=student).json()
    assert any(c["status"] == "accepted" for c in mine) and not keys_with_stored_at(mine)
    # admin: itens registrados por ele no export, reivindicações, devoluções e decisões trazem o campo
    assert keys_with_stored_at(client.get("/me/export", headers=admin).json()["itemsRegistered"])
    assert keys_with_stored_at(client.get("/claims/pending", headers=admin).json())
    assert keys_with_stored_at(client.get("/items/item-03/claims", headers=admin).json())
    assert keys_with_stored_at(client.get("/returns", headers=admin).json())
    assert keys_with_stored_at(client.post("/claims/claim-01/accept", headers=admin).json())


def test_stored_at_hidden_in_put_response_is_admin_only_route(client, student, admin):
    assert client.put("/items/item-01", data=ITEM_FORM, headers=student).status_code == 403
    assert "storedAt" in client.put("/items/item-01", data=ITEM_FORM, headers=admin).json()


def test_accepted_claimant_does_not_get_stored_at(client):
    h = password_login(client, "marina@demo.test")  # claim-04 aceita (item-05)
    body = client.get("/items/item-05", headers=h).json()
    assert body["myClaims"][0]["status"] == "accepted" and "storedAt" not in body["item"]


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
