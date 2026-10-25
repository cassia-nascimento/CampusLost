"""B1/1: papel `external` (comunidade externa)."""

from __future__ import annotations

import pytest

from app.rules.permissions import PERMISSIONS, has_capability
from tests.conftest import password_login
from tests.helpers import CLAIM, create_item, signup_payload, signup_verified


class Actor:
    def __init__(self, role):
        self.role = role


@pytest.mark.parametrize("capability", sorted(PERMISSIONS))
def test_external_has_exactly_the_permissions_of_student_and_teacher(capability):
    assert has_capability(Actor("external"), capability) == has_capability(Actor("student"), capability)
    assert has_capability(Actor("external"), capability) == has_capability(Actor("teacher"), capability)


def test_external_cannot_do_admin_things(client):
    h = password_login(client, "externo@demo.test")
    assert client.get("/claims/pending", headers=h).status_code == 403
    assert client.post("/claims/claim-01/accept", headers=h).status_code == 403
    assert client.get("/returns", headers=h).status_code == 403
    assert client.delete("/items/item-01", headers=h).status_code == 403


def test_demo_external_user_can_register_item_claim_and_see_own_claims(client):
    h = password_login(client, "externo@demo.test")
    me = client.get("/auth/me", headers=h).json()
    assert me["role"] == "external" and me["emailVerified"] is True
    assert create_item(client, h).status_code == 201
    claim = client.post("/items/item-01/claims", json=CLAIM, headers=h)
    assert claim.status_code == 201
    mine = client.get("/claims/mine", headers=h)
    assert mine.status_code == 200 and [c["itemId"] for c in mine.json()] == ["item-01"]
    detail = client.get("/items/item-01", headers=h).json()
    assert detail["viewer"]["claim"]["allowed"] is False  # já tem reivindicação em andamento


def test_password_signup_accepts_external_and_works_after_verification(client, mailbox):
    r = client.post("/auth/signup", json=signup_payload("ext@exemplo.com", role="external"))
    assert r.status_code == 201 and r.json()["user"]["role"] == "external"
    client.cookies.clear()
    body = signup_verified(client, mailbox, email="ext2@exemplo.com", role="external")
    h = {"Authorization": f"Bearer {body['token']}"}
    assert create_item(client, h).status_code == 201
    assert client.post("/items/item-02/claims", json=CLAIM, headers=h).status_code == 201


def test_signup_still_refuses_admin(client):
    r = client.post("/auth/signup", json=signup_payload("x@exemplo.com", role="admin"))
    assert r.status_code == 422 and "role" in r.json()["fieldErrors"]
