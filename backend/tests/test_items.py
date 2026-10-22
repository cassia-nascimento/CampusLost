"""Itens: filtros, ordenação, criação, edição, exclusão e validação (AC02.x, AC03.x, AC06.1)."""

from __future__ import annotations

import pytest

from tests.conftest import ITEM_FORM

ORDER_REGISTERED = ["item-01", "item-02", "item-03", "item-07", "item-04", "item-05", "item-06", "item-08", "item-09"]


def ids(client, params=None, headers=None):
    r = client.get("/items", params=params or {}, headers=headers or {})
    assert r.status_code == 200, r.text
    return [i["id"] for i in r.json()]


def test_default_order_is_newest_registered_first(client):
    assert ids(client) == ORDER_REGISTERED


def test_filter_category(client):
    assert ids(client, {"category": "Eletrônicos"}) == ["item-01", "item-07", "item-05"]
    assert ids(client, {"category": "Chaves"}) == ["item-03"]


def test_filter_location(client):
    assert ids(client, {"location": "Cantina"}) == ["item-04", "item-06", "item-09"]


def test_filter_status(client):
    assert ids(client, {"status": "under_claim"}) == ["item-03", "item-07", "item-05"]
    assert "item-03" not in ids(client, {"status": "available"})


def test_filter_period_is_inclusive_and_uses_found_date(client):
    # foundDate: 01=22/10, 02=21/10, 03=20/10, 07=19/10, 04=18/10, 05=17/10, 06=16/10, 08=14/10, 09=11/10
    assert ids(client, {"from": "2026-10-19", "to": "2026-10-21"}) == ["item-02", "item-03", "item-07"]
    assert ids(client, {"from": "2026-10-22"}) == ["item-01"]
    assert ids(client, {"to": "2026-10-11"}) == ["item-09"]
    assert ids(client, {"from": "2026-10-23"}) == []


def test_filters_combine_with_and(client):
    assert ids(client, {"category": "Eletrônicos", "location": "Bloco A"}) == ["item-07"]
    assert ids(client, {"category": "Eletrônicos", "location": "Bloco A", "status": "available"}) == []
    assert ids(client, {"category": "Outros", "from": "2026-10-14", "to": "2026-10-16"}) == ["item-06", "item-08"]


def test_empty_filter_values_are_ignored(client):
    assert ids(client, {"category": "", "location": "", "from": "", "to": "", "status": "", "sort": ""}) == ORDER_REGISTERED


def test_returned_never_appears_even_when_filtered(client):
    assert ids(client, {"category": "Documentos"}) == ["item-02"]
    assert ids(client, {"location": "Biblioteca"}) == ["item-01", "item-05"]  # item-11 (devolvido) fica de fora


@pytest.mark.parametrize(
    "params, errors",
    [
        ({"category": "Inexistente"}, {"category": "Categoria inválida."}),
        ({"location": "Marte"}, {"location": "Local inválido."}),
        ({"status": "returned"}, {"status": "Situação inválida."}),
        ({"sort": "alfabetica"}, {"sort": "Ordenação inválida."}),
        ({"from": "ontem"}, {"from": "Informe uma data válida."}),
        ({"to": "2026-13-01"}, {"to": "Informe uma data válida."}),
        ({"from": "2026-10-20", "to": "2026-10-10"}, {"to": "A data final deve ser igual ou posterior à inicial."}),
    ],
)
def test_invalid_filters_are_422(client, params, errors):
    r = client.get("/items", params=params)
    assert r.status_code == 422
    assert r.json() == {"code": "VALIDATION", "message": "Confira os campos destacados.", "fieldErrors": errors}


def test_sort_by_found_date_vs_registered(client, teacher):
    # item novo: registrado AGORA, mas encontrado há muito tempo
    old = client.post("/items", data={**ITEM_FORM, "foundDate": "2026-09-01"}, headers=teacher).json()
    registered = ids(client)
    assert registered[0] == old["id"] and registered[1:] == ORDER_REGISTERED
    by_found = ids(client, {"sort": "found"})
    assert by_found == ORDER_REGISTERED + [old["id"]]
    assert ids(client, {"sort": "registered"}) == registered


def test_order_tiebreak_by_id(client, clock, teacher):
    a = client.post("/items", data=ITEM_FORM, headers=teacher).json()
    b = client.post("/items", data=ITEM_FORM, headers=teacher).json()  # mesmo instante (relógio fixo)
    assert a["createdAt"] == b["createdAt"]
    top2 = ids(client)[:2]
    assert top2 == sorted([a["id"], b["id"]])


# ---------- criação (AC02.x) ----------
def test_create_item_as_logged_user(client, student, clock):
    r = client.post("/items", data=ITEM_FORM, headers=student)
    assert r.status_code == 201
    item = r.json()
    assert item["status"] == "available" and item["createdById"] == "user-marina"
    assert item["photoUrl"] is None
    assert item["createdAt"] == "2026-10-22T15:00:00.000Z"
    assert {k: item[k] for k in ITEM_FORM} == ITEM_FORM
    again = client.get(f"/items/{item['id']}", headers=student).json()
    assert again["item"] == item and again["createdBy"]["name"] == "Marina Alves"


def test_create_item_trims_text_and_accepts_today(client, student):
    form = {**ITEM_FORM, "title": "  Agenda  ", "foundDate": "2026-10-22"}
    item = client.post("/items", data=form, headers=student).json()
    assert item["title"] == "Agenda"


def test_create_item_future_date_uses_configured_timezone(client, student):
    # relógio fixo: 22/10 12:00 em Fortaleza; amanhã é futuro
    r = client.post("/items", data={**ITEM_FORM, "foundDate": "2026-10-23"}, headers=student)
    assert r.status_code == 422 and r.json()["fieldErrors"] == {"foundDate": "A data não pode ser no futuro."}


def test_today_follows_local_calendar_not_utc(client, student, clock):
    from datetime import datetime

    clock.t = datetime(2026, 10, 23, 1, 30)  # 23/10 01:30 UTC = 22/10 22:30 em Fortaleza
    assert client.post("/items", data={**ITEM_FORM, "foundDate": "2026-10-22"}, headers=student).status_code == 201
    r = client.post("/items", data={**ITEM_FORM, "foundDate": "2026-10-23"}, headers=student)
    assert r.status_code == 422


@pytest.mark.parametrize(
    "field, value, message",
    [
        ("title", "ab", "Use pelo menos 3 caracteres."),
        ("title", "", "Informe um título."),
        ("title", "x" * 81, "Use no máximo 80 caracteres."),
        ("description", "curta", "Use pelo menos 10 caracteres."),
        ("description", "x" * 501, "Use no máximo 500 caracteres."),
        ("category", "Nada", "Escolha uma categoria."),
        ("category", "", "Escolha uma categoria."),
        ("foundLocation", "Lua", "Escolha o local onde foi encontrado."),
        ("foundDate", "", "Informe uma data válida."),
        ("foundDate", "2026-02-30", "Informe uma data válida."),
        ("foundDate", "22/10/2026", "Informe uma data válida."),
        ("storedAt", "ab", "Use pelo menos 3 caracteres."),
        ("storedAt", "x" * 121, "Use no máximo 120 caracteres."),
    ],
)
def test_create_item_validation(client, student, field, value, message):
    r = client.post("/items", data={**ITEM_FORM, field: value}, headers=student)
    assert r.status_code == 422
    assert r.json() == {"code": "VALIDATION", "message": "Confira os campos destacados.", "fieldErrors": {field: message}}


def test_create_item_missing_fields(client, student):
    r = client.post("/items", data={}, headers=student)
    assert r.status_code == 422
    assert r.json()["fieldErrors"] == {
        "title": "Informe um título.",
        "description": "Informe uma descrição.",
        "category": "Escolha uma categoria.",
        "foundLocation": "Escolha o local onde foi encontrado.",
        "foundDate": "Informe a data.",
        "storedAt": "Informe onde o item está guardado.",
    }


def test_create_item_ignores_forged_server_fields(client, student):
    form = {**ITEM_FORM, "status": "returned", "createdById": "user-admin", "id": "item-01", "photoUrl": "/uploads/x.png"}
    item = client.post("/items", data=form, headers=student).json()
    assert item["status"] == "available" and item["createdById"] == "user-marina" and item["id"] != "item-01"
    assert item["photoUrl"] is None


# ---------- edição / exclusão (AC06.1) ----------
def test_admin_updates_item(client, admin):
    form = {**ITEM_FORM, "title": "Fones azuis", "storedAt": "Secretaria"}
    r = client.put("/items/item-01", data=form, headers=admin)
    assert r.status_code == 200
    item = r.json()
    assert item["id"] == "item-01" and item["title"] == "Fones azuis" and item["storedAt"] == "Secretaria"
    assert item["status"] == "available"
    assert item["createdById"] == "user-rafael" and item["createdAt"].startswith("2026-10-22T12:00")
    assert item["photoUrl"] == "/uploads/seed/fones-de-ouvido.svg"  # sem foto no envio: mantém


def test_update_keeps_status(client, admin):
    r = client.put("/items/item-03", data=ITEM_FORM, headers=admin)
    assert r.json()["status"] == "under_claim"


def test_update_validation(client, admin):
    r = client.put("/items/item-01", data={**ITEM_FORM, "title": "x"}, headers=admin)
    assert r.status_code == 422 and r.json()["fieldErrors"] == {"title": "Use pelo menos 3 caracteres."}
    assert client.get("/items/item-01", headers=admin).json()["item"]["title"] == "Fones de ouvido sem fio"


def test_update_unknown_item_404(client, admin):
    assert client.put("/items/item-xx", data=ITEM_FORM, headers=admin).status_code == 404


def test_admin_deletes_item(client, admin):
    r = client.delete("/items/item-02", headers=admin)
    assert r.status_code == 204 and r.content == b""
    assert client.get("/items/item-02", headers=admin).status_code == 404
    assert "item-02" not in ids(client)
    assert client.delete("/items/item-02", headers=admin).status_code == 404


def test_viewer_edit_delete_for_admin_on_active_item(client, admin):
    v = client.get("/items/item-01", headers=admin).json()["viewer"]
    assert v["edit"] == {"allowed": True} and v["delete"] == {"allowed": True}
    assert v["claim"]["code"] == "FORBIDDEN"


def test_unknown_item_detail_404(client, student):
    r = client.get("/items/item-xx", headers=student)
    assert r.status_code == 404 and r.json() == {"code": "NOT_FOUND", "message": "Item não encontrado."}


def test_catalog(client):
    r = client.get("/catalog")
    assert r.json()["categories"] == ["Eletrônicos", "Documentos", "Roupas", "Chaves", "Outros"]
    assert r.json()["locations"] == ["Bloco A", "Biblioteca", "Cantina", "Portaria"]
    assert "demonstração" in r.json()["notice"]
