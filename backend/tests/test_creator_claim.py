"""P46 / AC04.12: quem registrou o item não o reivindica (cadastrante != solicitante != proprietário confirmado).

Seed: item-01 (Rafael, disponível), item-03 (Lucas, em reivindicação: claim-01 Beatriz e claim-02 Rafael pendentes)."""

from __future__ import annotations

from sqlalchemy import func, select

from app.models import ClaimRow, ItemRow
from tests.conftest import ITEM_FORM, login, password_login
from tests.helpers import CLAIM

MESSAGE = "Você registrou este item, então não pode reivindicá-lo. Se ele é seu, procure a administração."
DENIED = {"code": "FORBIDDEN", "message": MESSAGE}


def claim_count(app, item_id):
    with app.state.session_factory() as s:
        return s.scalar(select(func.count()).select_from(ClaimRow).where(ClaimRow.item_id == item_id))


def item_status(app, item_id):
    with app.state.session_factory() as s:
        return s.get(ItemRow, item_id).status


def new_item(client, headers):
    r = client.post("/items", data=ITEM_FORM, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def viewer_claim(client, item_id, headers):
    return client.get(f"/items/{item_id}", headers=headers).json()["viewer"]["claim"]


def test_creator_cannot_claim_own_item(app, client, student):
    iid = new_item(client, student)
    assert viewer_claim(client, iid, student) == {"allowed": False, **DENIED}
    r = client.post(f"/items/{iid}/claims", json=CLAIM, headers=student)
    assert r.status_code == 403 and r.json() == DENIED
    assert claim_count(app, iid) == 0 and item_status(app, iid) == "available"


def test_another_eligible_user_claims_normally(app, client, student, teacher):
    iid = new_item(client, student)
    assert viewer_claim(client, iid, teacher) == {"allowed": True}
    r = client.post(f"/items/{iid}/claims", json=CLAIM, headers=teacher)
    assert r.status_code == 201 and r.json()["claimantId"] == "user-rafael" and r.json()["status"] == "pending"
    assert item_status(app, iid) == "under_claim"


def test_creator_cannot_forge_claimant_or_creator_in_body(app, client, student):
    iid = new_item(client, student)
    forged = {**CLAIM, "claimantId": "user-rafael", "createdById": "user-rafael", "status": "accepted"}
    r = client.post(f"/items/{iid}/claims", json=forged, headers=student)
    assert r.status_code == 403 and r.json() == DENIED
    assert claim_count(app, iid) == 0 and item_status(app, iid) == "available"


def test_non_creator_cannot_bypass_by_sending_creator_id(app, client, student, teacher):
    iid = new_item(client, student)  # criadora: Marina
    forged = {**CLAIM, "claimantId": "user-marina", "createdById": "user-rafael"}
    r = client.post(f"/items/{iid}/claims", json=forged, headers=teacher)
    assert r.status_code == 201
    assert r.json()["claimantId"] == "user-rafael"  # sempre o usuário da sessão
    with app.state.session_factory() as s:
        assert s.get(ItemRow, iid).created_by_id == "user-marina"  # nada vindo do cliente muda o cadastrante


def test_visitor_still_gets_401(app, client, student):
    iid = new_item(client, student)
    client.cookies.clear()
    r = client.post(f"/items/{iid}/claims", json=CLAIM)
    assert r.status_code == 401 and r.json()["code"] == "UNAUTHENTICATED"
    assert claim_count(app, iid) == 0


def test_rule_is_per_item_creator_can_claim_someone_elses_item(app, client, student):
    new_item(client, student)
    new_item(client, student)  # Marina cadastrou outros itens
    assert viewer_claim(client, "item-01", student) == {"allowed": True}  # item-01 é do Rafael
    r = client.post("/items/item-01/claims", json=CLAIM, headers=student)
    assert r.status_code == 201 and r.json()["claimantId"] == "user-marina"


def test_existing_claims_are_untouched_and_creator_sees_block(app, client, admin):
    lucas = password_login(client, "lucas@demo.test")  # criador de item-03
    before = client.get("/items/item-03/claims", headers=admin).json()
    assert [c["id"] for c in before] == ["claim-01", "claim-02"]
    assert viewer_claim(client, "item-03", lucas) == {"allowed": False, **DENIED}
    r = client.post("/items/item-03/claims", json=CLAIM, headers=lucas)
    assert r.status_code == 403
    assert client.get("/items/item-03/claims", headers=admin).json() == before
    assert item_status(app, "item-03") == "under_claim"
    # a rodada de terceiros segue funcionando no mesmo item
    ext = password_login(client, "externo@demo.test")
    assert client.post("/items/item-03/claims", json=CLAIM, headers=ext).status_code == 201
    assert claim_count(app, "item-03") == 3


def test_admin_who_registered_item_still_cannot_claim_and_is_not_owner(app, client, admin):
    iid = new_item(client, admin)
    v = viewer_claim(client, iid, admin)
    assert v == {"allowed": False, "code": "FORBIDDEN", "message": "A administração analisa reivindicações, mas não reivindica itens."}
    r = client.post(f"/items/{iid}/claims", json=CLAIM, headers=admin)
    # a checagem de capacidade (`require_user`) vem antes e prevalece sobre P46: nunca a mensagem do cadastrante
    assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN" and r.json()["message"] != MESSAGE
    assert claim_count(app, iid) == 0 and item_status(app, iid) == "available"  # nenhuma posse criada


def test_registering_does_not_confer_ownership_only_accepted_claimant_is_owner(app, client, student, teacher, admin):
    iid = new_item(client, student)  # cadastrante: Marina
    assert claim_count(app, iid) == 0  # cadastrar não cria reivindicação
    cid = client.post(f"/items/{iid}/claims", json=CLAIM, headers=teacher).json()["id"]  # solicitante: Rafael
    assert client.post(f"/claims/{cid}/accept", headers=admin).status_code == 200
    with app.state.session_factory() as s:
        accepted = s.scalars(select(ClaimRow).where(ClaimRow.item_id == iid, ClaimRow.status == "accepted")).all()
        assert [c.claimant_id for c in accepted] == ["user-rafael"]  # proprietário confirmado = solicitante aceito
        assert s.get(ItemRow, iid).created_by_id == "user-marina"
    assert viewer_claim(client, iid, student) == {"allowed": False, **DENIED}  # cadastrante segue sem reivindicar
