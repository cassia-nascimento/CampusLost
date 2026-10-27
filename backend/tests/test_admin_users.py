"""B2/2: gestão de usuários, desativação e convites de administração."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from app.models import AdminInviteRow, SessionRow
from tests.admin_helpers import PW, bearer, login, make_admin_with_2fa, make_user, token_of, user_row
from tests.conftest import extract_token


def setup_admin(client, app, clock):
    headers, _, _ = make_admin_with_2fa(client, app, clock)
    return headers


def test_list_users_search_filters_and_pagination(client, admin):
    r = client.get("/admin/users", headers=admin)
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"items", "page", "pageSize", "total", "totalPages"} and body["total"] >= 6
    assert set(body["items"][0]) == {
        "id", "name", "email", "role", "affiliation", "provider", "active", "disabledAt", "emailVerified", "twoFactorEnabled", "createdAt",
    }
    assert "password_hash" not in r.text and "$2" not in r.text and "totp" not in r.text.replace("twoFactor", "")
    q = client.get("/admin/users?q=MARINA", headers=admin).json()
    assert [u["email"] for u in q["items"]] == ["marina@demo.test"]
    assert client.get("/admin/users?q=demo.test&role=user&affiliation=external", headers=admin).json()["items"][0]["email"] == "externo@demo.test"
    assert client.get("/admin/users?affiliation=institutional&role=admin", headers=admin).json()["total"] == 1
    assert client.get("/admin/users?affiliation=aluno", headers=admin).status_code == 422
    for old in ("student", "teacher", "external"):
        assert client.get(f"/admin/users?role={old}", headers=admin).status_code == 422
        assert client.patch("/admin/users/user-marina", json={"role": old}, headers=admin).status_code == 422
    assert client.get("/admin/users?q=%25", headers=admin).json()["total"] == 0  # curingas são literais
    page = client.get("/admin/users?pageSize=2&page=2", headers=admin).json()
    assert len(page["items"]) == 2 and page["page"] == 2 and page["totalPages"] >= 3
    assert client.get("/admin/users?role=root", headers=admin).status_code == 422
    assert client.get("/admin/users?status=x", headers=admin).status_code == 422
    assert client.get("/admin/users?page=0", headers=admin).status_code == 422
    assert client.get("/admin/users?pageSize=101", headers=admin).status_code == 422
    assert client.get("/admin/users?status=disabled", headers=admin).json()["total"] == 0


def test_patch_role_and_audit(client, app, admin):
    uid = user_row(app, "marina@demo.test").id
    r = client.patch(f"/admin/users/{uid}", json={"role": "admin"}, headers=admin)
    assert r.status_code == 200 and r.json()["role"] == "admin" and r.json()["affiliation"] == "institutional"
    assert user_row(app, "marina@demo.test").role == "admin"
    from tests.admin_helpers import audit_rows

    row = audit_rows(app, "user.role_change")[0]
    assert row.target_id == uid and row.meta == {"from": "user", "to": "admin"} and row.actor_id == "user-admin"


def test_patch_validation_and_not_found(client, admin):
    assert client.patch("/admin/users/user-marina", json={"role": "root"}, headers=admin).status_code == 422
    assert client.patch("/admin/users/user-marina", json={"active": "sim"}, headers=admin).status_code == 422
    assert client.patch("/admin/users/user-marina", json={}, headers=admin).status_code == 422
    assert client.patch("/admin/users/inexistente", json={"role": "user"}, headers=admin).status_code == 404


def test_disable_blocks_login_revokes_sessions_and_reenable(client, app, admin):
    r = client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"})
    victim = bearer(r.json()["token"])
    client.cookies.clear()
    assert client.get("/auth/me", headers=victim).status_code == 200
    res = client.patch("/admin/users/user-marina", json={"active": False}, headers=admin)
    assert res.status_code == 200 and res.json()["active"] is False and res.json()["disabledAt"]
    assert client.get("/auth/me", headers=victim).status_code == 401  # token de acesso morreu
    with app.state.session_factory() as s:
        assert all(x.revoked_at for x in s.scalars(select(SessionRow).where(SessionRow.user_id == "user-marina")).all())
    bad = client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"})
    assert bad.status_code == 403 and bad.json()["code"] == "ACCOUNT_DISABLED"
    wrong = client.post("/auth/login", json={"email": "marina@demo.test", "password": "senha-errada-1"})
    assert wrong.status_code == 401  # senha errada não revela que a conta está desativada
    assert client.get("/admin/users?status=disabled", headers=admin).json()["total"] == 1
    assert client.patch("/admin/users/user-marina", json={"active": True}, headers=admin).json()["active"] is True
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"}).status_code == 200
    from tests.admin_helpers import audit_rows

    assert len(audit_rows(app, "user.disable")) == 1 and len(audit_rows(app, "user.enable")) == 1


def test_disabled_user_cannot_refresh_cookies(client, admin):
    client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"})
    cookies = dict(client.cookies)
    client.cookies.clear()
    client.patch("/admin/users/user-marina", json={"active": False}, headers=admin)
    client.cookies.update(cookies)
    r = client.post("/auth/refresh", headers={"X-Requested-With": "x"})
    assert r.status_code == 401


def test_cannot_change_self(client, app, clock):
    headers = setup_admin(client, app, clock)
    me = user_row(app, "chefe@exemplo.com").id
    for body in ({"role": "user"}, {"active": False}):
        r = client.patch(f"/admin/users/{me}", json=body, headers=headers)
        assert r.status_code == 409 and r.json()["code"] == "CONFLICT"
    assert user_row(app, "chefe@exemplo.com").role == "admin"


def test_demote_and_disable_other_admins_while_one_remains(client, app, clock):
    headers = setup_admin(client, app, clock)
    second = make_user(app, "outro@exemplo.com")
    assert client.patch(f"/admin/users/{second.id}", json={"active": False}, headers=headers).status_code == 200
    assert client.patch(f"/admin/users/{second.id}", json={"active": True}, headers=headers).status_code == 200
    assert client.patch(f"/admin/users/{second.id}", json={"role": "user"}, headers=headers).status_code == 200


def test_last_active_admin_guard(client, app, clock, monkeypatch):
    """Quem age é sempre um admin ativo diferente do alvo, então a trava só dispara se a contagem de OUTROS admins
    ativos for zero (corrida/dado inconsistente). Forçamos esse estado."""
    headers = setup_admin(client, app, clock)
    import app.routers.admin as admin_router

    monkeypatch.setattr(admin_router, "_other_active_admins", lambda db, uid: 0)
    r = client.patch("/admin/users/user-admin", json={"role": "user"}, headers=headers)
    assert r.status_code == 409 and "última conta de administração" in r.json()["message"]
    assert client.patch("/admin/users/user-admin", json={"active": False}, headers=headers).status_code == 409
    assert user_row(app, "admin@demo.test").role == "admin" and user_row(app, "admin@demo.test").disabled_at is None
    assert client.patch("/admin/users/user-marina", json={"role": "admin"}, headers=headers).status_code == 200  # não-admin: livre


def test_promote_to_admin(client, app, admin):
    r = client.patch("/admin/users/user-rafael", json={"role": "admin"}, headers=admin)
    assert r.status_code == 200 and r.json()["role"] == "admin"


# --- convites -------------------------------------------------------------------------------------------------


def test_invite_flow_creates_verified_admin_once(client, app, admin, mailbox):
    r = client.post("/admin/invites", json={"email": "Nova.Admin@Exemplo.com"}, headers=admin)
    assert r.status_code == 201
    inv = r.json()
    assert inv["email"] == "nova.admin@exemplo.com" and inv["status"] == "pending" and "token" not in r.text
    assert inv["expiresAt"] == "2026-10-24T15:00:00.000Z" or inv["expiresAt"].startswith("2026-10-24T15:00:00")  # 48 h
    msg = mailbox.sent[-1]
    assert msg.to == "nova.admin@exemplo.com" and "/aceitar-convite?token=" in msg.link
    token = extract_token(msg)
    with app.state.session_factory() as s:
        row = s.scalar(select(AdminInviteRow))
        assert row.token_hash != token and len(row.token_hash) == 64  # só hash
    weak = client.post("/auth/accept-invite", json={"token": token, "name": "Nova Admin", "password": "curta"})
    assert weak.status_code == 422 and "password" in weak.json()["fieldErrors"]
    ok = client.post("/auth/accept-invite", json={"token": token, "name": "Nova Admin", "password": PW})
    assert ok.status_code == 201
    assert ok.json()["user"]["role"] == "admin" and ok.json()["user"]["emailVerified"] is True
    assert user_row(app, "nova.admin@exemplo.com").role == "admin"
    again = client.post("/auth/accept-invite", json={"token": token, "name": "Outra", "password": PW})
    assert again.status_code == 400 and again.json()["code"] == "INVALID_TOKEN"
    listed = client.get("/admin/invites", headers=admin).json()
    assert listed["items"][0]["status"] == "accepted"
    from tests.admin_helpers import audit_rows

    assert len(audit_rows(app, "invite.create")) == 1 and len(audit_rows(app, "invite.accept")) == 1


def test_invite_expires_after_48_hours(client, admin, mailbox, clock):
    client.post("/admin/invites", json={"email": "a@exemplo.com"}, headers=admin)
    token = extract_token(mailbox.sent[-1])
    clock.advance(hours=47)
    # ainda vale; (não consumimos): confere pelo status
    assert client.get("/admin/invites", headers=admin).json()["items"][0]["status"] == "pending"
    clock.advance(hours=2)
    assert client.get("/admin/invites", headers=admin).json()["items"][0]["status"] == "expired"
    r = client.post("/auth/accept-invite", json={"token": token, "name": "Fulana", "password": PW})
    assert r.status_code == 400


def test_revoke_invite_and_reissue_revokes_previous(client, admin, mailbox):
    client.post("/admin/invites", json={"email": "a@exemplo.com"}, headers=admin)
    first = extract_token(mailbox.sent[-1])
    second_inv = client.post("/admin/invites", json={"email": "a@exemplo.com"}, headers=admin).json()
    assert client.post("/auth/accept-invite", json={"token": first, "name": "Fulana", "password": PW}).status_code == 400
    assert client.delete(f"/admin/invites/{second_inv['id']}", headers=admin).status_code == 204
    second = extract_token(mailbox.sent[-1])
    assert client.post("/auth/accept-invite", json={"token": second, "name": "Fulana", "password": PW}).status_code == 400
    statuses = sorted(i["status"] for i in client.get("/admin/invites", headers=admin).json()["items"])
    assert statuses == ["revoked", "revoked"]
    assert client.delete("/admin/invites/nao-existe", headers=admin).status_code == 404


def test_invite_rejects_existing_email_and_bad_input(client, admin):
    assert client.post("/admin/invites", json={"email": "marina@demo.test"}, headers=admin).status_code == 409
    assert client.post("/admin/invites", json={"email": "nao-e-email"}, headers=admin).status_code == 422


def test_invite_routes_need_admin(client, student):
    assert client.post("/admin/invites", json={"email": "a@exemplo.com"}, headers=student).status_code == 403
    assert client.post("/auth/accept-invite", json={"token": "x" * 30, "name": "N N", "password": PW}).status_code == 400


def test_new_invited_admin_needs_2fa_for_admin_routes(strict_client, strict_app, mailbox, clock):
    headers, _, _ = make_admin_with_2fa(strict_client, strict_app, clock)
    strict_client.post("/admin/invites", json={"email": "nova@exemplo.com"}, headers=headers)
    token = extract_token(mailbox.sent[-1])
    r = strict_client.post("/auth/accept-invite", json={"token": token, "name": "Nova Pessoa", "password": PW})
    h = bearer(r.json()["token"])
    got = strict_client.get("/admin/users", headers=h)
    assert got.status_code == 403 and got.json()["code"] == "TWO_FACTOR_REQUIRED"


def test_invited_admin_gets_affiliation_from_email_domain(client, admin, mailbox):
    for email, expected in (("nova@undb.edu.br", "institutional"), ("outra@gmail.com", "external")):
        client.post("/admin/invites", json={"email": email}, headers=admin)
        r = client.post("/auth/accept-invite", json={"token": extract_token(mailbox.sent[-1]), "name": "Nova Admin", "password": PW})
        assert r.status_code == 201 and r.json()["user"]["role"] == "admin" and r.json()["user"]["affiliation"] == expected
    client.cookies.clear()


def test_admin_checks_use_role_not_affiliation(client, app, admin):
    """Papel `admin` com vínculo `external` continua admin; `user` institucional nunca vira admin por e-mail."""
    from tests.admin_helpers import make_user

    make_user(app, "chefe@gmail.com", role="admin")
    # make_user grava institutional; ajusta para provar que o vínculo não influencia
    from app.models import UserRow
    from sqlalchemy import select

    with app.state.session_factory() as s:
        u = s.scalar(select(UserRow).where(UserRow.email == "chefe@gmail.com"))
        u.affiliation = "external"
        s.commit()
    h = token_of(client, "chefe@gmail.com")
    assert client.get("/admin/users", headers=h).status_code == 200  # demo: 2FA isento
    assert client.get("/admin/users", headers=login_demo(client)).status_code == 403


def login_demo(client):
    r = client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"})
    client.cookies.clear()
    return bearer(r.json()["token"])
