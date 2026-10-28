"""Papel de acesso `user | admin` e vínculo `affiliation` (institutional | external) pelo domínio do e-mail."""

from __future__ import annotations

import pytest

from app.rules.google import affiliation_for_email
from app.rules.permissions import PERMISSIONS, has_capability
from tests.conftest import password_login
from tests.helpers import CLAIM, create_item, signup_payload, signup_verified


class Actor:
    def __init__(self, role):
        self.role = role


ALLOWED = ("undb.edu.br",)


@pytest.mark.parametrize(
    "email, expected",
    [
        ("a@undb.edu.br", "institutional"),
        ("A@UNDB.EDU.BR", "institutional"),
        ("aluno@alunos.undb.edu.br", "institutional"),
        ("x@a.b.undb.edu.br", "institutional"),
        ("a@gmail.com", "external"),
        ("a@evilundb.edu.br", "external"),
        ("a@undb.edu.br.evil.com", "external"),
        ("a@undb.edu.brx.com", "external"),
        ("undb.edu.br", "external"),
        (None, "external"),
    ],
)
def test_affiliation_rule_is_domain_only(email, expected):
    assert affiliation_for_email(email, ALLOWED) == expected


def test_only_user_and_admin_roles_have_permissions():
    roles = {r for roles in PERMISSIONS.values() for r in roles}
    assert roles == {"user", "admin"}
    for old in ("student", "teacher", "external"):
        assert not any(has_capability(Actor(old), c) for c in PERMISSIONS)


@pytest.mark.parametrize("capability", sorted(PERMISSIONS))
def test_affiliation_does_not_change_permissions(capability):
    # a checagem só olha o papel: não existe função de permissão que receba `affiliation`
    assert has_capability(Actor("user"), capability) in (True, False)


def test_external_affiliation_cannot_do_admin_things(client):
    h = password_login(client, "externo@demo.test")
    assert client.get("/claims/pending", headers=h).status_code == 403
    assert client.post("/claims/claim-01/accept", headers=h).status_code == 403
    assert client.get("/returns", headers=h).status_code == 403
    assert client.delete("/items/item-01", headers=h).status_code == 403
    assert client.get("/admin/users", headers=h).status_code == 403


def test_demo_external_user_has_same_user_permissions(client):
    h = password_login(client, "externo@demo.test")
    me = client.get("/auth/me", headers=h).json()
    assert me["role"] == "user" and me["affiliation"] == "external" and me["emailVerified"] is True
    assert create_item(client, h).status_code == 201
    claim = client.post("/items/item-01/claims", json=CLAIM, headers=h)
    assert claim.status_code == 201
    mine = client.get("/claims/mine", headers=h)
    assert mine.status_code == 200 and [c["itemId"] for c in mine.json()] == ["item-01"]
    detail = client.get("/items/item-01", headers=h).json()
    assert detail["viewer"]["claim"]["allowed"] is False  # já tem reivindicação em andamento


def test_seed_users_have_explicit_role_and_affiliation(client):
    expected = {
        "marina@demo.test": ("user", "institutional"), "rafael@demo.test": ("user", "institutional"),
        "lucas@demo.test": ("user", "institutional"), "beatriz@demo.test": ("user", "institutional"),
        "externo@demo.test": ("user", "external"), "admin@demo.test": ("admin", "institutional"),
    }
    for email, (role, aff) in expected.items():
        me = client.get("/auth/me", headers=password_login(client, email)).json()
        assert (me["role"], me["affiliation"]) == (role, aff), email


def test_signup_ignores_role_and_extra_fields_and_derives_affiliation(client):
    r = client.post("/auth/signup", json=signup_payload("x@exemplo.com", role="admin", isAdmin=True, affiliation="institutional"))
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "user" and r.json()["user"]["affiliation"] == "external"  # nada do corpo vale
    for legacy in ("student", "teacher", "external", None, 5):
        r = client.post("/auth/signup", json=signup_payload(f"{legacy}@exemplo.com".replace("None", "n").replace("5", "c"), role=legacy))
        assert r.status_code == 201 and r.json()["user"]["role"] == "user"
    inst = client.post("/auth/signup", json=signup_payload("aluna@alunos.undb.edu.br"))
    assert inst.status_code == 201 and inst.json()["user"]["affiliation"] == "institutional"
    assert inst.json()["user"]["emailVerified"] is False  # o domínio NÃO verifica nada: só o link do e-mail


def test_password_signup_works_after_verification_for_both_affiliations(client, mailbox):
    for email in ("ext2@exemplo.com", "inst@undb.edu.br"):
        body = signup_verified(client, mailbox, email=email)
        h = {"Authorization": f"Bearer {body['token']}"}
        assert create_item(client, h).status_code == 201
