"""B1/8: LGPD — aceite dos termos, exportação (`GET /me/export`) e exclusão/anonimização (`DELETE /me`)."""

from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app import google_auth
from app.models import ClaimRow, EmailTokenRow, ItemRow, SessionRow, UserRow
from tests.conftest import DEMO_PASSWORD, FIXED_NOW, password_login
from tests.helpers import CLAIM, bearer, db_user, signup_payload
from tests.test_google import tokeninfo


def test_signup_requires_accepting_terms_and_records_version(client, app):
    for bad in (None, False, "true", 1, "on"):
        r = client.post("/auth/signup", json=signup_payload("t@exemplo.com", acceptTerms=bad))
        assert r.status_code == 422
        assert r.json()["fieldErrors"]["acceptTerms"] == "Aceite os termos de uso e a política de privacidade para continuar."
    body = signup_payload("t@exemplo.com")
    del body["acceptTerms"]
    assert client.post("/auth/signup", json=body).status_code == 422
    assert db_user(app, "t@exemplo.com") is None
    assert client.post("/auth/signup", json=signup_payload("t@exemplo.com")).status_code == 201
    row = db_user(app, "t@exemplo.com")
    assert row.terms_accepted_at == FIXED_NOW and row.terms_version == "2026-10"


def test_export_has_my_data_and_no_secrets(client):
    h = password_login(client, "marina@demo.test")
    r = client.get("/me/export", headers=h)
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    assert r.headers["cache-control"] == "no-store"
    data = r.json()
    assert data["format"] == "campuslost-export-v1" and data["exportedAt"].endswith("Z")
    assert data["account"]["email"] == "marina@demo.test" and data["account"]["role"] == "student"
    assert data["account"]["emailVerifiedAt"] and data["account"]["termsVersion"] == "2026-10"
    assert [i["id"] for i in data["itemsRegistered"]] == ["item-08"]
    assert {c["id"] for c in data["claims"]} == {"claim-03", "claim-04", "claim-06"}
    assert all(c["claimantId"] == "user-marina" and c["itemTitle"] for c in data["claims"])
    assert data["sessions"] and all(set(s) == {"id", "createdAt", "expiresAt", "revokedAt"} for s in data["sessions"])
    text = r.text
    assert "$2b$" not in text and h["Authorization"].split()[1] not in text  # nunca hash de senha nem token

    def keys(node):
        if isinstance(node, dict):
            for k, v in node.items():
                yield k.lower()
                yield from keys(v)
        elif isinstance(node, list):
            for v in node:
                yield from keys(v)

    assert not [k for k in keys(data) if any(w in k for w in ("hash", "token", "secret", "password"))]


def test_export_only_contains_own_data(client):
    data = client.get("/me/export", headers=password_login(client, "rafael@demo.test")).json()
    owners = {c["claimantId"] for c in data["claims"]}
    assert owners == {"user-rafael"} and all(i["createdById"] == "user-rafael" for i in data["itemsRegistered"])
    assert {r["id"] for r in data["returns"]} == {"return-02"} and data["returns"][0]["role"] == "returnedTo"


def test_export_for_admin_lists_registered_returns(client):
    data = client.get("/me/export", headers=password_login(client, "admin@demo.test")).json()
    assert {r["role"] for r in data["returns"]} == {"registeredBy"} and len(data["returns"]) == 2


def test_export_and_delete_require_authentication(client):
    assert client.get("/me/export").status_code == 401
    assert client.request("DELETE", "/me", json={"password": DEMO_PASSWORD}).status_code == 401


def test_export_works_for_unverified_account(client):
    token = client.post("/auth/signup", json=signup_payload("u@exemplo.com")).json()["token"]
    client.cookies.clear()
    assert client.get("/me/export", headers=bearer(token)).json()["account"]["emailVerifiedAt"] is None


# --- exclusão -----------------------------------------------------------------------------------------------------


def delete_me(client, h, **body):
    return client.request("DELETE", "/me", json=body, headers=h)


def test_delete_requires_correct_password(client, app):
    h = password_login(client, "externo@demo.test")
    for body in ({}, {"password": "errada-errada-1"}, {"password": 5}, {"credential": "x"}):
        r = delete_me(client, h, **body)
        assert r.status_code == 403 and r.json()["code"] == "INVALID_CREDENTIALS"
    assert client.get("/auth/me", headers=h).status_code == 200
    assert db_user(app, "externo@demo.test").deleted_at is None


def test_delete_wrong_password_is_rate_limited(client):
    h = password_login(client, "externo@demo.test")
    for _ in range(10):
        assert delete_me(client, h, password="errada-errada-1").status_code == 403
    assert delete_me(client, h, password=DEMO_PASSWORD).status_code == 429


def test_delete_anonymizes_account_and_keeps_items(client, app):
    h = password_login(client, "marina@demo.test")
    r = delete_me(client, h, password=DEMO_PASSWORD)
    assert r.status_code == 204
    cleared = [c.lower() for c in r.headers.get_list("set-cookie")]
    assert len(cleared) == 2 and all("max-age=0" in c for c in cleared)
    # sessão e login morreram
    assert client.get("/auth/me", headers=h).status_code == 401
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD}).status_code == 401
    # a linha ficou anonimizada
    with app.state.session_factory() as s:
        u = s.get(UserRow, "user-marina")
        assert u.name == "Usuário removido" and u.email == "removido-user-marina@excluido.invalid"
        assert u.password_hash is None and u.provider == "deleted" and u.deleted_at == FIXED_NOW
        assert not s.scalars(select(SessionRow).where(SessionRow.user_id == "user-marina")).all()
        assert s.get(ItemRow, "item-08") is not None  # o item continua
    # o item continua visível, com o autor anônimo
    admin = password_login(client, "admin@demo.test")
    detail = client.get("/items/item-08", headers=admin).json()
    assert detail["createdBy"]["name"] == "Usuário removido" and detail["item"]["id"] == "item-08"
    # e-mail original liberado para novo cadastro
    assert client.post("/auth/signup", json=signup_payload("marina@demo.test")).status_code == 201


def test_delete_closes_open_claims_redacts_text_and_frees_the_item(client, app):
    h = password_login(client, "externo@demo.test")
    assert client.post("/items/item-01/claims", json=CLAIM, headers=h).status_code == 201
    assert client.get("/items/item-01", headers=h).json()["item"]["status"] == "under_claim"
    assert delete_me(client, h, password=DEMO_PASSWORD).status_code == 204
    admin = password_login(client, "admin@demo.test")
    assert client.get("/items/item-01", headers=admin).json()["item"]["status"] == "available"
    with app.state.session_factory() as s:
        claim = s.scalar(select(ClaimRow).where(ClaimRow.claimant_id == db_user(app, "removido-user-externo@excluido.invalid").id))
        assert claim.status == "rejected" and claim.reviewed_at == FIXED_NOW
        assert CLAIM["proofDetails"] not in claim.proof_details and "removido" in claim.proof_details.lower()


def test_delete_keeps_item_under_claim_when_other_pending_claims_exist(client):
    h = password_login(client, "marina@demo.test")  # claim-06 pendente no item-07, que tem a claim-07 da Beatriz
    assert delete_me(client, h, password=DEMO_PASSWORD).status_code == 204
    admin = password_login(client, "admin@demo.test")
    assert client.get("/items/item-07", headers=admin).json()["item"]["status"] == "under_claim"
    pending = {c["id"] for c in client.get("/claims/pending", headers=admin).json()}
    assert "claim-06" not in pending and "claim-07" in pending


def test_delete_removes_pending_tokens_and_old_bearer_tokens(client, app):
    token = client.post("/auth/signup", json=signup_payload("del@exemplo.com")).json()["token"]
    client.cookies.clear()
    assert delete_me(client, bearer(token), password="senha-forte-1").status_code == 204
    with app.state.session_factory() as s:
        assert s.scalar(select(func.count()).select_from(EmailTokenRow)) == 0


def test_last_admin_cannot_delete_account(client):
    h = password_login(client, "admin@demo.test")
    r = delete_me(client, h, password=DEMO_PASSWORD)
    assert r.status_code == 409 and r.json()["code"] == "CONFLICT"
    assert client.get("/auth/me", headers=h).status_code == 200


def test_deleted_user_cannot_use_cookies_or_forgot_password(client, mailbox, app):
    h = password_login(client, "externo@demo.test")
    client.post("/auth/login", json={"email": "externo@demo.test", "password": DEMO_PASSWORD})  # cookies de sessão
    assert delete_me(client, h, password=DEMO_PASSWORD).status_code == 204
    assert client.get("/auth/me").status_code == 401
    assert client.post("/auth/forgot-password", json={"email": "externo@demo.test"}).status_code == 202
    assert mailbox.sent == []


# --- conta Google ---------------------------------------------------------------------------------------------------


@pytest.fixture
def fake_google(monkeypatch):
    state = {"response": tokeninfo(email="pessoa@gmail.com", name="Pessoa Google")}
    monkeypatch.setattr(google_auth, "fetch_tokeninfo", lambda settings, credential: state["response"])
    return state


def test_google_account_deletion_needs_a_fresh_google_credential(client, fake_google, app):
    created = client.post("/auth/google", json={"credential": "c", "acceptTerms": True}).json()
    assert created["status"] == "signed_in" and created["user"]["role"] == "external"
    h = bearer(created["token"])
    assert delete_me(client, h).status_code == 403  # sem confirmação
    assert delete_me(client, h, password="qualquer-coisa-1").status_code == 403  # conta sem senha
    fake_google["response"] = tokeninfo(email="outra@gmail.com")  # credencial de OUTRA conta
    assert delete_me(client, h, credential="c2").status_code == 403
    fake_google["response"] = None  # Google recusa o token: a conta continua
    assert delete_me(client, h, credential="c3").status_code == 401
    assert client.get("/auth/me", headers=h).status_code == 200
    fake_google["response"] = tokeninfo(email="pessoa@gmail.com", name="Pessoa Google")
    assert delete_me(client, h, credential="c4").status_code == 204
    assert db_user(app, "pessoa@gmail.com") is None
    assert client.get("/auth/me", headers=h).status_code == 401


def test_account_json_has_password_flag_everywhere(client, fake_google):
    login = client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD}).json()
    assert login["user"]["hasPassword"] is True
    assert client.get("/auth/me", headers=bearer(login["token"])).json()["hasPassword"] is True
    signup = client.post("/auth/signup", json=signup_payload("hp@exemplo.com")).json()
    assert signup["user"]["hasPassword"] is True
    g = client.post("/auth/google", json={"credential": "c", "acceptTerms": True}).json()
    assert g["user"]["hasPassword"] is False
    assert client.get("/auth/me", headers=bearer(g["token"])).json()["hasPassword"] is False
