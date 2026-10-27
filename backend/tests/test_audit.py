"""B2/1: trilha de auditoria."""

from __future__ import annotations

from sqlalchemy import select

from app import audit
from app.models import AuditLogRow
from tests.admin_helpers import PW, audit_rows, bearer, login, make_admin_with_2fa, make_user, token_of, user_row
from tests.conftest import DEMO_PASSWORD, extract_token
from tests.helpers import CLAIM, signup, signup_payload

ADMIN_EMAIL = "admin@demo.test"


def actions(app) -> list[str]:
    return [r.action for r in audit_rows(app)]


def test_clean_metadata_drops_sensitive_keys():
    out = audit.clean_metadata({"password": "x", "token": "y", "totpSecret": "z", "code": "1", "recoveryCode": "2",
                                 "passwordHash": "h", "role": "admin", "n": 3, "long": "a" * 500})
    assert set(out) == {"role", "n", "long"} and len(out["long"]) == 200
    assert audit.clean_metadata({"password": "x"}) is None


def test_login_success_failure_and_block(client, app):
    ok = client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD})
    assert ok.status_code == 200
    for _ in range(10):
        assert client.post("/auth/login", json={"email": "marina@demo.test", "password": "errada-errada1"}).status_code == 401
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD}).status_code == 429
    a = actions(app)
    assert a.count("login.success") == 1 and a.count("login.failure") == 10 and a.count("login.blocked") == 1
    ok_row = audit_rows(app, "login.success")[0]
    assert ok_row.actor_id == "user-marina" and ok_row.ip and ok_row.meta == {"method": "password"}


def test_login_failure_for_unknown_email_has_no_actor_and_no_plain_email(client, app):
    client.post("/auth/login", json={"email": "fantasma@exemplo.com", "password": "errada-errada1"})
    row = audit_rows(app, "login.failure")[0]
    assert row.actor_id is None and "fantasma" not in str(row.meta) and len(row.meta["emailRef"]) == 12


def test_signup_verify_logout_reset_are_recorded(client, app, mailbox):
    body = signup(client)
    assert actions(app) == ["signup"]
    client.post("/auth/verify-email", json={"token": extract_token(mailbox.sent[-1])})
    login_r = client.post("/auth/login", json={"email": "novo@exemplo.com", "password": "senha-forte-1"})
    h = bearer(login_r.json()["token"])
    assert client.post("/auth/logout", headers=h).status_code == 204
    client.post("/auth/forgot-password", json={"email": "novo@exemplo.com"})
    client.post("/auth/reset-password", json={"token": extract_token(mailbox.sent[-1]), "password": "outra-senha-forte-2"})
    assert actions(app) == ["signup", "email.verify", "login.success", "logout", "password.reset"]
    assert all(r.actor_id == body["user"]["id"] for r in audit_rows(app))


def test_admin_decisions_are_recorded(client, app, admin, student):
    item = client.post("/items", data={
        "title": "Agenda", "description": "Agenda vermelha com elástico e capa dura.", "category": "Outros",
        "foundLocation": "Biblioteca", "foundDate": "2026-10-21", "storedAt": "Portaria"}, headers=student).json()
    pending = client.get("/claims/pending", headers=admin).json()
    cid = pending[0]["id"]
    assert client.post(f"/claims/{cid}/accept", headers=admin).status_code == 200
    iid = pending[0]["item"]["id"]
    assert client.post(f"/items/{iid}/return", headers=admin).status_code == 201
    assert client.delete(f"/items/{item['id']}", headers=admin).status_code == 204
    a = actions(app)
    assert "claim.accept" in a and "return.register" in a and "item.delete" in a
    acc = audit_rows(app, "claim.accept")[0]
    assert acc.actor_id == "user-admin" and acc.target_id == cid and acc.meta["itemId"] == iid
    assert audit_rows(app, "item.delete")[0].meta["title"] == "Agenda"


def test_claim_reject_is_recorded(client, app, admin):
    cid = client.get("/claims/pending", headers=admin).json()[0]["id"]
    assert client.post(f"/claims/{cid}/reject", headers=admin).status_code == 200
    assert audit_rows(app, "claim.reject")[0].target_id == cid


def test_account_delete_is_recorded(client, app):
    body = signup(client)
    h = bearer(client.post("/auth/login", json={"email": "novo@exemplo.com", "password": "senha-forte-1"}).json()["token"])
    r = client.request("DELETE", "/me", json={"password": "senha-forte-1"}, headers=h)
    assert r.status_code == 204
    row = audit_rows(app, "account.delete")[0]
    assert row.actor_id == body["user"]["id"]


def test_two_factor_events_are_recorded_without_secrets(client, app, clock):
    make_user(app, "u@exemplo.com", role="user")
    h = token_of(client, "u@exemplo.com")
    secret = client.post("/auth/2fa/setup", headers=h).json()["secret"]
    client.post("/auth/2fa/enable", json={"code": "000000"}, headers=h)
    from tests.admin_helpers import current_code

    r = client.post("/auth/2fa/enable", json={"code": current_code(clock, secret)}, headers=h)
    codes = r.json()["recoveryCodes"]
    clock.advance(seconds=30)
    client.post("/auth/2fa/disable", json={"password": PW, "code": current_code(clock, secret)}, headers=h)
    assert [x for x in actions(app) if x.startswith("2fa")] == ["2fa.failure", "2fa.enable", "2fa.disable"]
    with client.app.state.session_factory() as s:
        dump = " ".join(str(x.meta) + str(x.target_id) for x in s.scalars(select(AuditLogRow)).all())
    assert secret not in dump and not any(c in dump for c in codes) and PW not in dump


def test_no_secret_ever_lands_in_the_audit_table(client, app, mailbox):
    signup(client)
    client.post("/auth/login", json={"email": "novo@exemplo.com", "password": "senha-forte-1"})
    client.post("/auth/login", json={"email": "novo@exemplo.com", "password": "errada-errada1"})
    with app.state.session_factory() as s:
        dump = " ".join(repr((x.actor_id, x.action, x.target_id, x.ip, x.meta)) for x in s.scalars(select(AuditLogRow)).all())
    assert "senha-forte-1" not in dump and "errada-errada1" not in dump and "$2" not in dump
    assert "eyJ" not in dump  # nenhum JWT


def test_get_audit_filters_and_pagination(client, app, admin):
    for _ in range(3):
        client.post("/auth/login", json={"email": "marina@demo.test", "password": "errada-errada1"})
    client.post("/auth/login", json={"email": "marina@demo.test", "password": DEMO_PASSWORD})
    r = client.get("/admin/audit", headers=admin)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 4 and set(body["items"][0]) == {
        "id", "at", "actorId", "actorName", "action", "targetType", "targetId", "ip", "metadata"}
    assert body["items"][0]["action"] == "login.success"  # mais recente primeiro
    fails = client.get("/admin/audit?action=login.failure", headers=admin).json()
    assert fails["total"] == 3 and all(i["action"] == "login.failure" for i in fails["items"])
    by_actor = client.get("/admin/audit?actor=user-marina", headers=admin).json()
    assert by_actor["total"] == 4 and by_actor["items"][0]["actorName"]
    page = client.get("/admin/audit?pageSize=2&page=2", headers=admin).json()
    assert len(page["items"]) == 2 and page["totalPages"] == 2
    assert client.get("/admin/audit?action=nada", headers=admin).json()["items"] == []


def test_get_audit_is_admin_only(client, student):
    assert client.get("/admin/audit", headers=student).status_code == 403
    assert client.get("/admin/audit").status_code == 401
