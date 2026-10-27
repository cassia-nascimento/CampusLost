"""Máquina de estados e critérios de aceite AC04.x / AC05.x / AC06.1, premissas P14, P15, P18, P19.

Seed: item-01 disponível; item-03 em reivindicação (claim-01 Beatriz, claim-02 Rafael pendentes);
item-04 disponível com claim-03 recusada (Marina); item-05 em reivindicação com claim-04 aceita (Marina) e claim-05 recusada (Lucas);
item-07 em reivindicação (claim-06 Marina, claim-07 Beatriz pendentes); item-10/11 devolvidos.
"""

from __future__ import annotations

from tests.conftest import ITEM_FORM, login, password_login

BODY = {"proofDetails": "Tem um adesivo azul na parte de trás.", "lostWhereWhen": "Biblioteca, ontem de manhã."}


def status_of(client, item_id, headers):
    return client.get(f"/items/{item_id}", headers=headers).json()["item"]["status"]


# ---------- AC04.1: botão "É meu" e motivos ----------
def test_ac04_1_viewer_claim_decisions(client, student, teacher, admin):
    def claim_decision(item_id, headers):
        return client.get(f"/items/{item_id}", headers=headers).json()["viewer"]["claim"]

    assert claim_decision("item-01", student) == {"allowed": True}
    assert claim_decision("item-03", student) == {"allowed": True}  # em reivindicação, ainda sem pedido dela
    assert claim_decision("item-07", student)["code"] == "DUPLICATE_CLAIM"  # pendente dela
    assert claim_decision("item-07", student)["message"] == "Você já tem uma reivindicação em andamento para este item."
    assert claim_decision("item-05", student) == {
        "allowed": False,
        "code": "DUPLICATE_CLAIM",
        "message": "Sua reivindicação foi aceita. Procure a administração para retirar o item.",
    }
    assert claim_decision("item-04", student) == {
        "allowed": False,
        "code": "CLAIM_BLOCKED",
        "message": "Sua reivindicação para este item foi recusada. Procure a administração.",
    }
    # P14: item com reivindicação aceita bloqueia qualquer outra pessoa
    assert claim_decision("item-05", teacher) == {
        "allowed": False,
        "code": "CLAIM_BLOCKED",
        "message": "Este item já tem uma reivindicação aceita e aguarda a devolução.",
    }
    assert claim_decision("item-10", student) == {"allowed": False, "code": "ITEM_RETURNED", "message": "Este item já foi devolvido."}
    assert claim_decision("item-01", admin) == {
        "allowed": False,
        "code": "FORBIDDEN",
        "message": "A administração analisa reivindicações, mas não reivindica itens.",
    }


# ---------- AC04.2 / AC04.3 ----------
def test_ac04_2_claim_moves_available_to_under_claim_and_ac04_3_many_claimants(client, student, teacher):
    assert status_of(client, "item-02", student) == "available"
    r = client.post("/items/item-02/claims", json=BODY, headers=student)
    assert r.status_code == 201
    claim = r.json()
    assert claim["status"] == "pending" and claim["itemId"] == "item-02" and claim["claimantId"] == "user-marina"
    assert "reviewedAt" not in claim and claim["createdAt"].endswith("Z")
    assert status_of(client, "item-02", student) == "under_claim"
    # outro usuário reivindica o mesmo item
    assert client.post("/items/item-02/claims", json=BODY, headers=teacher).status_code == 201
    assert status_of(client, "item-02", teacher) == "under_claim"


def test_duplicate_active_claim_is_409(client, student):
    assert client.post("/items/item-02/claims", json=BODY, headers=student).status_code == 201
    r = client.post("/items/item-02/claims", json=BODY, headers=student)
    assert r.status_code == 409
    assert r.json() == {"code": "DUPLICATE_CLAIM", "message": "Você já tem uma reivindicação em andamento para este item."}


def test_claim_on_blocked_or_returned_items(client, student, teacher):
    assert client.post("/items/item-04/claims", json=BODY, headers=student).json()["code"] == "CLAIM_BLOCKED"
    assert client.post("/items/item-05/claims", json=BODY, headers=teacher).json()["code"] == "CLAIM_BLOCKED"
    r = client.post("/items/item-10/claims", json=BODY, headers=student)
    assert r.status_code == 409 and r.json()["code"] == "ITEM_RETURNED"
    assert client.post("/items/item-zz/claims", json=BODY, headers=student).status_code == 404


def test_claim_validation(client, student):
    r = client.post("/items/item-01/claims", json={"proofDetails": "curto", "lostWhereWhen": "x"}, headers=student)
    assert r.status_code == 422
    assert r.json() == {
        "code": "VALIDATION",
        "message": "Confira os campos destacados.",
        "fieldErrors": {"proofDetails": "Use pelo menos 10 caracteres.", "lostWhereWhen": "Use pelo menos 5 caracteres."},
    }
    r = client.post("/items/item-01/claims", json={}, headers=student)
    assert r.json()["fieldErrors"] == {
        "proofDetails": "Informe os detalhes que só o dono saberia.",
        "lostWhereWhen": "Informe onde e quando você perdeu o item.",
    }
    r = client.post("/items/item-01/claims", json={"proofDetails": "x" * 501, "lostWhereWhen": "y" * 301}, headers=student)
    assert r.json()["fieldErrors"] == {"proofDetails": "Use no máximo 500 caracteres.", "lostWhereWhen": "Use no máximo 300 caracteres."}
    assert status_of(client, "item-01", student) == "available"  # nada mudou


# ---------- AC04.4: administração vê pendentes (P17: mais antigas primeiro) ----------
def test_ac04_4_pending_list_oldest_first_with_views(client, admin):
    r = client.get("/claims/pending", headers=admin)
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    # claim-01 (20h), claim-02 (8h), claim-06 (30h), claim-07 (12h) -> mais antiga primeiro
    assert ids == ["claim-06", "claim-01", "claim-07", "claim-02"]
    first = r.json()[0]
    assert first["claimant"] == {"id": "user-marina", "name": "Marina Alves", "email": "marina@demo.test", "role": "user"}
    assert first["item"]["id"] == "item-07" and first["item"]["storedAt"] == "Portaria"
    by_item = client.get("/items/item-03/claims", headers=admin).json()
    assert [c["id"] for c in by_item] == ["claim-01", "claim-02"]


# ---------- AC04.5: aceitar recusa as demais ----------
def test_ac04_5_accept_auto_rejects_others_and_keeps_item_under_claim(client, admin):
    r = client.post("/claims/claim-01/accept", headers=admin)
    assert r.status_code == 200
    body = r.json()
    assert body["claim"]["status"] == "accepted" and body["claim"]["reviewedAt"].endswith("Z")
    assert body["autoRejectedIds"] == ["claim-02"]
    assert body["item"]["status"] == "under_claim"
    claims = {c["id"]: c for c in client.get("/items/item-03/claims", headers=admin).json()}
    assert claims["claim-02"]["status"] == "rejected" and claims["claim-02"]["reviewedAt"]
    # P14: depois do aceite ninguém reivindica
    rafael = login(client, "teacher")
    assert client.post("/items/item-03/claims", json=BODY, headers=rafael).json()["code"] == "CLAIM_BLOCKED"


def test_accept_without_other_pending(client, admin):
    body = client.post("/claims/claim-06/accept", headers=admin).json()
    assert body["autoRejectedIds"] == ["claim-07"]


# ---------- AC04.6: recusar a última ativa devolve o item a Disponível ----------
def test_ac04_6_reject_last_active_returns_item_to_available(client, admin):
    first = client.post("/claims/claim-01/reject", headers=admin).json()
    assert first["claim"]["status"] == "rejected" and first["autoRejectedIds"] == []
    assert first["item"]["status"] == "under_claim"  # ainda sobra a claim-02
    last = client.post("/claims/claim-02/reject", headers=admin).json()
    assert last["item"]["status"] == "available"
    assert client.get("/items/item-03", headers=admin).json()["item"]["status"] == "available"


# ---------- AC04.7: recusado não reenvia ----------
def test_ac04_7_rejected_user_sees_rejected_and_cannot_resubmit(client, admin):
    beatriz = password_login(client, "beatriz@demo.test")
    client.post("/claims/claim-01/reject", headers=admin)
    client.post("/claims/claim-02/reject", headers=admin)
    mine = {c["id"]: c for c in client.get("/claims/mine", headers=beatriz).json()}
    assert mine["claim-01"]["status"] == "rejected"
    d = client.get("/items/item-03", headers=beatriz).json()
    assert d["viewer"]["claim"]["code"] == "CLAIM_BLOCKED"
    r = client.post("/items/item-03/claims", json=BODY, headers=beatriz)
    assert r.status_code == 409 and r.json()["code"] == "CLAIM_BLOCKED"


# ---------- AC04.8: minhas reivindicações refletem o estado atual ----------
def test_ac04_8_my_claims_reflect_changes_newest_first(client, student, admin):
    before = client.get("/claims/mine", headers=student).json()
    assert [c["id"] for c in before] == ["claim-06", "claim-03", "claim-04"]
    assert {c["id"]: c["status"] for c in before}["claim-06"] == "pending"
    client.post("/claims/claim-06/accept", headers=admin)
    after = {c["id"]: c for c in client.get("/claims/mine", headers=student).json()}
    assert after["claim-06"]["status"] == "accepted"
    assert after["claim-06"]["item"]["status"] == "under_claim"
    created = [c["createdAt"] for c in client.get("/claims/mine", headers=student).json()]
    assert created == sorted(created, reverse=True)


# ---------- P15: aceita não se desfaz ----------
def test_p15_accepted_claim_cannot_be_reverted(client, admin):
    for action in ("reject", "accept"):
        r = client.post(f"/claims/claim-04/{action}", headers=admin)
        assert r.status_code == 409
        assert r.json() == {"code": "INVALID_TRANSITION", "message": "Esta reivindicação já foi analisada."}
    assert client.post("/claims/claim-05/accept", headers=admin).json()["code"] == "INVALID_TRANSITION"  # recusada


def test_review_unknown_claim_and_returned_item(client, admin):
    assert client.post("/claims/claim-xx/accept", headers=admin).status_code == 404
    r = client.post("/claims/claim-08/reject", headers=admin)  # claim aceita de item devolvido
    assert r.status_code == 409 and r.json()["code"] == "ITEM_RETURNED"


# ---------- AC05.x ----------
def test_ac05_return_requires_accepted_claim(client, admin):
    r = client.post("/items/item-03/return", headers=admin)  # só pendentes
    assert r.status_code == 409
    assert r.json() == {"code": "INVALID_TRANSITION", "message": "Aceite uma reivindicação antes de registrar a devolução."}
    r = client.post("/items/item-01/return", headers=admin)  # disponível
    assert r.json() == {"code": "INVALID_TRANSITION", "message": "Só é possível devolver um item que está em reivindicação."}
    assert client.post("/items/item-zz/return", headers=admin).status_code == 404


def test_ac05_1_viewer_register_return_only_with_accepted_claim(client, admin):
    assert client.get("/items/item-05", headers=admin).json()["viewer"]["registerReturn"] == {"allowed": True}
    assert client.get("/items/item-03", headers=admin).json()["viewer"]["registerReturn"]["allowed"] is False
    client.post("/claims/claim-01/accept", headers=admin)
    assert client.get("/items/item-03", headers=admin).json()["viewer"]["registerReturn"] == {"allowed": True}


def test_ac05_2_return_flow(client, admin, student):
    r = client.post("/items/item-05/return", headers=admin)
    assert r.status_code == 201
    view = r.json()
    assert view["itemId"] == "item-05" and view["claimId"] == "claim-04"
    assert view["returnedToId"] == "user-marina"  # P19: autor da reivindicação aceita
    assert view["registeredById"] == "user-admin"
    assert view["item"]["status"] == "returned"
    assert view["returnedTo"]["email"] == "marina@demo.test"
    assert view["registeredBy"] == {"id": "user-admin", "name": "Administração Demo", "role": "admin"}
    # some da busca e aparece na listagem
    assert "item-05" not in [i["id"] for i in client.get("/items", headers=student).json()]
    assert client.get("/items/item-05").status_code == 404
    listed = client.get("/returns", headers=admin).json()
    assert listed[0]["id"] == view["id"] and len(listed) == 3
    # devolução não se repete nem se desfaz
    again = client.post("/items/item-05/return", headers=admin)
    assert again.status_code == 409 and again.json() == {"code": "ITEM_RETURNED", "message": "Este item já foi devolvido."}


def test_returned_items_are_read_only(client, admin):
    r = client.put("/items/item-10", data=ITEM_FORM, headers=admin)
    assert r.status_code == 409 and r.json() == {"code": "ITEM_RETURNED", "message": "Itens devolvidos não podem ser editados."}
    r = client.delete("/items/item-10", headers=admin)
    assert r.status_code == 409 and r.json() == {"code": "ITEM_RETURNED", "message": "Itens devolvidos não podem ser excluídos."}
    v = client.get("/items/item-10", headers=admin).json()["viewer"]
    assert v["edit"]["code"] == "ITEM_RETURNED" and v["delete"]["code"] == "ITEM_RETURNED"
    assert v["registerReturn"]["code"] == "ITEM_RETURNED"


def test_ac05_3_returns_period_filter(client, admin):
    # return-01: 120h antes (17/10), return-02: 288h antes (10/10); "hoje" = 22/10/2026 (America/Fortaleza)
    ids = lambda **q: [r["id"] for r in client.get("/returns", params=q, headers=admin).json()]  # noqa: E731
    assert ids() == ["return-01", "return-02"]  # mais recentes primeiro
    assert ids(**{"from": "2026-10-15"}) == ["return-01"]
    assert ids(to="2026-10-12") == ["return-02"]
    assert ids(**{"from": "2026-10-10", "to": "2026-10-10"}) == ["return-02"]  # inclusivo
    assert ids(**{"from": "2026-10-18"}) == []
    assert ids(**{"from": "", "to": ""}) == ["return-01", "return-02"]
    r = client.get("/returns", params={"from": "2026-10-20", "to": "2026-10-01"}, headers=admin)
    assert r.status_code == 422 and r.json()["fieldErrors"] == {"to": "A data final deve ser igual ou posterior à inicial."}
    r = client.get("/returns", params={"from": "2026-02-30"}, headers=admin)
    assert r.json()["fieldErrors"] == {"from": "Informe uma data válida."}


# ---------- P18 ----------
def test_p18_deleting_item_removes_its_claims(client, admin, student):
    beatriz = password_login(client, "beatriz@demo.test")
    assert any(c["id"] == "claim-01" for c in client.get("/claims/mine", headers=beatriz).json())
    assert client.delete("/items/item-03", headers=admin).status_code == 204
    assert client.get("/items/item-03", headers=admin).status_code == 404
    assert client.get("/claims/claim-01", headers=admin).status_code == 404
    assert client.get("/claims/claim-02", headers=admin).status_code == 404
    assert not any(c["itemId"] == "item-03" for c in client.get("/claims/mine", headers=beatriz).json())
    assert "claim-01" not in [c["id"] for c in client.get("/claims/pending", headers=admin).json()]


def test_admin_detail_shows_claim_after_review(client, admin):
    client.post("/claims/claim-02/accept", headers=admin)
    body = client.get("/items/item-03", headers=admin).json()
    statuses = {c["id"]: c["status"] for c in body["claims"]}
    assert statuses == {"claim-01": "rejected", "claim-02": "accepted"}


def test_full_flow_register_claim_accept_return(client, student, teacher, admin):
    created = client.post("/items", data=ITEM_FORM, headers=teacher)
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert client.get("/items", headers=student).json()[0]["id"] == item_id  # topo da busca (AC02.3)
    assert client.post(f"/items/{item_id}/claims", json=BODY, headers=student).status_code == 201
    claim_id = client.get(f"/items/{item_id}/claims", headers=admin).json()[0]["id"]
    assert client.post(f"/claims/{claim_id}/accept", headers=admin).status_code == 200
    ret = client.post(f"/items/{item_id}/return", headers=admin)
    assert ret.status_code == 201 and ret.json()["returnedToId"] == "user-marina"
    assert item_id not in [i["id"] for i in client.get("/items", headers=student).json()]
