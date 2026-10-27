"""Privacidade do local de guarda (`storedAt`): só administração, ou reivindicante ACEITO enquanto o item aguarda devolução.

Seed relevante: item-05 (under_claim) tem claim-04 ACEITA de Marina (e claim-05 recusada de Lucas), criado por Rafael;
item-03/item-07 (under_claim) só têm pendentes; item-04 tem claim-03 recusada de Marina; item-10/item-11 estão devolvidos
(claim-08 de Beatriz, claim-09 de Rafael, aceitas)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app.models import ClaimRow, ItemRow
from app.rules.items import can_view_stored_at
from tests.conftest import FIXED_NOW, ITEM_FORM, do_return_flow, password_login
from tests.helpers import CLAIM

ITEM_IDS = [f"item-{n:02d}" for n in range(1, 12)]


def marker(item_id: str) -> str:
    return f"GUARDA-SECRETA-{item_id}"


@pytest.fixture(autouse=True)
def marked_stored_at(app, client):  # `client` garante o seed; cada item recebe um local de guarda único e identificável
    with app.state.session_factory() as s:
        for item in s.scalars(select(ItemRow)).all():
            item.stored_at = marker(item.id)
        s.commit()


def has_key(value) -> bool:
    if isinstance(value, dict):
        return "storedAt" in value or any(has_key(v) for v in value.values())
    if isinstance(value, list):
        return any(has_key(v) for v in value)
    return False


def stored_of(client, headers, item_id: str):
    """`storedAt` de um item em GET /items/{id} (None se a chave não vier)."""
    r = client.get(f"/items/{item_id}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()["item"].get("storedAt")


def in_list(client, headers, item_id: str):
    r = client.get("/items", headers=headers)
    assert r.status_code == 200
    row = next(i for i in r.json() if i["id"] == item_id)
    return row.get("storedAt")


def in_my_claims(client, headers, item_id: str):
    r = client.get("/claims/mine", headers=headers)
    assert r.status_code == 200
    rows = [c["item"] for c in r.json() if c["item"]["id"] == item_id]
    assert rows, item_id
    return {tuple(sorted(x)) for x in rows}, [x.get("storedAt") for x in rows]


@pytest.fixture
def lucas(client):  # criador de item-03/07; claim-05 RECUSADA em item-05
    return password_login(client, "lucas@demo.test")


@pytest.fixture
def marina(client):
    return password_login(client, "marina@demo.test")


@pytest.fixture
def beatriz(client):
    return password_login(client, "beatriz@demo.test")


@pytest.fixture
def externo(client):
    return password_login(client, "externo@demo.test")


# ---------- regra pura ----------
def _item(status="under_claim", iid="i1"):
    return SimpleNamespace(id=iid, status=status)


def _c(status="accepted", user="u1", iid="i1"):
    return SimpleNamespace(id="c", item_id=iid, claimant_id=user, status=status)


def test_rule_unit():
    admin, user = SimpleNamespace(id="a", role="admin"), SimpleNamespace(id="u1", role="user")
    assert can_view_stored_at(admin, _item("returned"), []) is True
    assert can_view_stored_at(None, _item(), [_c()]) is False
    assert can_view_stored_at(user, _item(), [_c()]) is True
    assert can_view_stored_at(user, _item("returned"), [_c()]) is False
    assert can_view_stored_at(user, _item("available"), [_c()]) is False
    assert can_view_stored_at(user, _item(), [_c("pending")]) is False
    assert can_view_stored_at(user, _item(), [_c("rejected")]) is False
    assert can_view_stored_at(user, _item(), [_c(user="u2")]) is False  # reivindicação aceita de outra pessoa
    assert can_view_stored_at(user, _item(), [_c(iid="outro")]) is False  # aceita em outro item
    assert can_view_stored_at(user, _item(), []) is False


# ---------- matriz ----------
def test_guest_never_sees(client):
    assert stored_of(client, {}, "item-05") is None
    assert in_list(client, {}, "item-05") is None


def test_unrelated_regular_user_never_sees(client, externo):
    for iid in ("item-03", "item-05", "item-07"):
        assert stored_of(client, externo, iid) is None and in_list(client, externo, iid) is None


def test_creator_does_not_see_by_authorship(client, teacher, lucas):
    # Rafael criou item-05 (que tem aceita de OUTRA pessoa); Lucas criou item-03/07
    assert stored_of(client, teacher, "item-05") is None and in_list(client, teacher, "item-05") is None
    assert stored_of(client, lucas, "item-03") is None and in_list(client, lucas, "item-07") is None
    created = client.post("/items", data=ITEM_FORM, headers=lucas)
    assert created.status_code == 201 and "storedAt" not in created.json()
    assert stored_of(client, lucas, created.json()["id"]) is None


def test_pending_claimant_does_not_see(client, marina, teacher, beatriz):
    assert stored_of(client, marina, "item-07") is None and in_list(client, marina, "item-07") is None  # claim-06 pendente
    assert stored_of(client, teacher, "item-03") is None and stored_of(client, beatriz, "item-03") is None
    keys, values = in_my_claims(client, marina, "item-07")
    assert values == [None] and all("storedAt" not in k for k in keys)
    assert client.get("/claims/claim-06", headers=marina).json()["item"].get("storedAt") is None


def test_rejected_claimant_does_not_see(client, lucas, marina):
    assert stored_of(client, lucas, "item-05") is None and in_list(client, lucas, "item-05") is None  # claim-05 recusada
    _, values = in_my_claims(client, lucas, "item-05")
    assert values == [None]
    _, values = in_my_claims(client, marina, "item-04")  # claim-03 recusada
    assert values == [None]


def test_accepted_claimant_sees_while_item_awaits_return(client, marina):
    assert stored_of(client, marina, "item-05") == marker("item-05")
    assert in_list(client, marina, "item-05") == marker("item-05")
    _, values = in_my_claims(client, marina, "item-05")
    assert values == [marker("item-05")]
    assert client.get("/claims/claim-04", headers=marina).json()["item"]["storedAt"] == marker("item-05")


def test_accepted_claimant_does_not_see_other_items(client, marina):
    for iid in ("item-03", "item-07", "item-01", "item-02"):
        assert stored_of(client, marina, iid) is None and in_list(client, marina, iid) is None
    listing = client.get("/items", headers=marina).json()
    assert [i["id"] for i in listing if "storedAt" in i] == ["item-05"]  # só o dela, mesmo na lista


def test_ex_claimant_of_returned_item_does_not_see(client, beatriz, teacher):
    assert stored_of(client, beatriz, "item-10") is None  # claim-08 aceita, item devolvido
    assert stored_of(client, teacher, "item-11") is None  # claim-09 aceita, item devolvido
    for headers, iid in ((beatriz, "item-10"), (teacher, "item-11")):
        _, values = in_my_claims(client, headers, iid)
        assert values == [None]


def test_admin_sees_everywhere(client, admin):
    listing = client.get("/items", headers=admin).json()
    assert listing and all(i["storedAt"] == marker(i["id"]) for i in listing)
    for iid in ITEM_IDS:
        assert stored_of(client, admin, iid) == marker(iid)  # inclusive devolvidos
    assert all(c["item"]["storedAt"] == marker(c["item"]["id"]) for c in client.get("/claims/pending", headers=admin).json())
    assert all(c["item"]["storedAt"] for c in client.get("/items/item-05/claims", headers=admin).json())
    assert all(r["item"]["storedAt"] for r in client.get("/returns", headers=admin).json())
    assert client.get("/claims/claim-04", headers=admin).json()["item"]["storedAt"] == marker("item-05")
    assert all(i["storedAt"] == marker(i["id"]) for i in client.get("/me/export", headers=admin).json()["itemsRegistered"])


# ---------- fluxo: pendente -> aceita -> devolvida / recusada ----------
def _claim(client, headers, item_id):
    r = client.post(f"/items/{item_id}/claims", json=CLAIM, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_flow_pending_accept_return(client, admin, marina, teacher, lucas):
    iid = client.post("/items", data=ITEM_FORM, headers=marina).json()["id"]  # Marina é a criadora
    mark = ITEM_FORM["storedAt"]
    cid = _claim(client, lucas, iid)
    other = _claim(client, teacher, iid)
    assert stored_of(client, lucas, iid) is None and in_list(client, lucas, iid) is None  # pendente nunca libera
    assert in_my_claims(client, lucas, iid)[1] == [None]

    accepted = client.post(f"/claims/{cid}/accept", headers=admin)
    assert accepted.status_code == 200 and accepted.json()["item"]["storedAt"] == mark  # admin
    assert stored_of(client, lucas, iid) == mark and in_list(client, lucas, iid) == mark
    assert in_my_claims(client, lucas, iid)[1] == [mark]
    assert client.get(f"/claims/{cid}", headers=lucas).json()["item"]["storedAt"] == mark
    assert stored_of(client, teacher, iid) is None  # a outra pendente foi recusada automaticamente
    assert in_my_claims(client, teacher, iid)[1] == [None]
    assert stored_of(client, marina, iid) is None and in_list(client, marina, iid) is None  # criadora
    assert client.get("/me/export", headers=marina).json()["itemsRegistered"][0].get("storedAt") is None
    assert client.get("/items/item-03", headers=lucas).status_code == 200 and stored_of(client, lucas, "item-03") is None
    assert other

    done = do_return_flow(client, lucas, admin, cid)
    assert done.status_code == 201 and done.json()["item"]["storedAt"] == mark  # admin
    assert stored_of(client, lucas, iid) is None  # devolvido: volta a ficar oculto
    assert in_my_claims(client, lucas, iid)[1] == [None]
    assert client.get(f"/claims/{cid}", headers=lucas).json()["item"].get("storedAt") is None
    assert stored_of(client, admin, iid) == mark


def test_flow_reject_keeps_hidden(client, admin, lucas, marina):
    cid = _claim(client, marina, "item-01")
    assert stored_of(client, marina, "item-01") is None
    rejected = client.post(f"/claims/{cid}/reject", headers=admin)
    assert rejected.status_code == 200 and rejected.json()["item"]["storedAt"] == marker("item-01")  # admin
    assert stored_of(client, marina, "item-01") is None and in_list(client, marina, "item-01") is None
    assert in_my_claims(client, marina, "item-01")[1] == [None]


def test_creator_who_is_also_accepted_claimant_sees_it(app, client, admin, marina):
    # P46: o cadastrante não consegue mais reivindicar o próprio item; o caso só existe em dado legado,
    # então a reivindicação aceita é gravada direto no banco (a regra de visibilidade continua valendo).
    iid = client.post("/items", data=ITEM_FORM, headers=marina).json()["id"]
    with app.state.session_factory() as s:
        item = s.get(ItemRow, iid)
        item.status = "under_claim"
        s.add(ClaimRow(id="claim-legado", item_id=iid, claimant_id=item.created_by_id, proof_details="Dado legado.",
                       lost_where_when="Dado legado.", status="accepted", created_at=FIXED_NOW, reviewed_at=FIXED_NOW))
        s.commit()
    export = client.get("/me/export", headers=marina).json()["itemsRegistered"]
    by_id = {i["id"]: i.get("storedAt") for i in export}
    assert by_id[iid] == ITEM_FORM["storedAt"]
    assert [v for k, v in by_id.items() if k != iid] == [None] * (len(by_id) - 1)  # os demais dela seguem ocultos
    other = client.post("/items", data=ITEM_FORM, headers=marina).json()["id"]  # outro item dela: continua oculto
    assert stored_of(client, marina, other) is None


# ---------- varredura textual: nenhum corpo vaza o local de guarda ----------
def _sweep(client, headers, own_claim_ids=()):
    bodies = []
    paths = ["/items", "/items?sort=found", "/claims/mine", "/me/export"] + [f"/items/{i}" for i in ITEM_IDS]
    paths += [f"/items?location={q}" for q in ("GUARDA", "SECRETA", marker("item-05"), "item-05")]
    paths += ["/items?category=Eletr%C3%B4nicos", "/items?status=under_claim", "/items?status=available&from=2020-01-01&to=2030-01-01"]
    paths += [f"/claims/{c}" for c in own_claim_ids]
    for p in paths:
        r = client.get(p, headers=headers)
        if r.status_code == 404 or (r.status_code == 401 and not headers):  # devolvido invisível / rota exige sessão
            continue
        assert r.status_code == 200, (p, r.status_code)
        bodies.append((p, r.text))
    return bodies


@pytest.mark.parametrize("who,claims", [("guest", ()), ("lucas", ("claim-05",)), ("teacher", ("claim-09",)), ("beatriz", ("claim-01", "claim-08", "claim-07")), ("externo", ())])
def test_text_sweep_unauthorized_never_leaks(client, request, who, claims):
    headers = {} if who == "guest" else request.getfixturevalue(who)
    # beatriz/teacher/lucas: só reivindicações pendentes, recusadas ou de itens já devolvidos; claim-01/07 são pendentes
    for path, text in _sweep(client, headers, claims if who != "guest" else ()):
        assert "GUARDA-SECRETA" not in text, path
        assert "storedAt" not in text, path


def test_text_sweep_post_response_for_regular_creator(client, externo):
    r = client.post("/items", data={**ITEM_FORM, "storedAt": "LOCAL-OCULTO-123"}, headers=externo)
    assert r.status_code == 201 and "LOCAL-OCULTO-123" not in r.text and "storedAt" not in r.text
    for p in ("/items", "/me/export", f"/items/{r.json()['id']}"):
        assert "LOCAL-OCULTO-123" not in client.get(p, headers=externo).text
    assert "LOCAL-OCULTO-123" not in client.get("/items?location=LOCAL-OCULTO", headers=externo).text
    assert "LOCAL-OCULTO-123" not in client.get("/items").text  # visitante


def test_text_sweep_accepted_claimant_only_sees_own_item(client, marina):
    for path, text in _sweep(client, marina, ("claim-04",)):
        others = [marker(i) for i in ITEM_IDS if i != "item-05"]
        assert not any(o in text for o in others), path
