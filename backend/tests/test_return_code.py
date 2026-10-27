"""Confirmação de devolução por código de retirada: gerar (dono) -> conferir (admin) -> confirmar a entrega (admin).

Seed: item-05 em reivindicação, claim-04 ACEITA (Marina), claim-05 recusada (Lucas), criado por Rafael; item-03 com
claim-01 (Beatriz) e claim-02 (Rafael) pendentes; claim-03 recusada (Marina, item-04); claim-08 aceita de item devolvido (Beatriz).
"""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import select

from app import audit
from app.models import AuditLogRow, ReturnCodeRow, ReturnRow
from app.rules import return_codes as rc
from tests.admin_helpers import audit_rows, make_user, token_of
from tests.conftest import FIXED_NOW, do_return_flow, issue_return_code, login, password_login

FORMAT = re.compile(r"^[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$")
CLAIM = "claim-04"  # Marina, aceita, item-05
ITEM = "item-05"


@pytest.fixture
def marina(student):
    return student


@pytest.fixture
def rafael(teacher):
    return teacher


@pytest.fixture
def beatriz(client):
    return password_login(client, "beatriz@demo.test")


@pytest.fixture
def lucas(client):
    return password_login(client, "lucas@demo.test")


def verify(client, admin, code, claim=CLAIM):
    return client.post(f"/claims/{claim}/return-code/verify", json={"code": code}, headers=admin)


def wrong_of(real: str) -> str:
    return "AAAA-AAAA" if real != "AAAA-AAAA" else "BBBB-BBBB"


def rows(app, model=ReturnCodeRow):
    with app.state.session_factory() as s:
        return list(s.scalars(select(model)).all())


def code_row(app, claim=CLAIM) -> ReturnCodeRow:
    with app.state.session_factory() as s:
        return s.scalar(select(ReturnCodeRow).where(ReturnCodeRow.claim_id == claim))


def admin_status(client, admin, claim=CLAIM):
    r = client.get(f"/claims/{claim}/return-code", headers=admin)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- (1) aceitar não gera código ----------
def test_accept_does_not_issue_or_return_a_code(client, app, admin, beatriz):
    r = client.post("/claims/claim-01/accept", headers=admin)
    assert r.status_code == 200
    assert "code" not in r.json() and "returnCode" not in r.json()
    assert rows(app) == []
    got = client.get("/claims/claim-01/return-code", headers=beatriz)
    assert got.status_code == 200 and got.json() == {"issued": False, "issuedAt": None}


def test_seed_has_no_codes_and_owner_sees_issued_false(client, app, marina):
    assert rows(app) == []
    assert client.get(f"/claims/{CLAIM}/return-code", headers=marina).json() == {"issued": False, "issuedAt": None}


# ---------- (2) geração: formato, só hash no banco ----------
def test_owner_generates_code_and_only_the_hash_is_stored(client, app, marina, admin):
    r = client.post(f"/claims/{CLAIM}/return-code", headers=marina)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert set(body) == {"code", "issuedAt"} and FORMAT.match(body["code"])
    assert body["issuedAt"] == "2026-10-22T15:00:00.000Z"
    plain, bare = body["code"], body["code"].replace("-", "")

    (row,) = rows(app)
    assert row.claim_id == CLAIM and row.item_id == ITEM and row.issued_at == FIXED_NOW
    assert re.fullmatch(r"[0-9a-f]{64}", row.code_hash)
    assert row.failed_attempts == 0 and row.verified_at is None and row.used_at is None and row.locked_until is None
    for value in (getattr(row, c.name) for c in ReturnCodeRow.__table__.columns):
        assert plain not in str(value) and bare not in str(value)
    for a in rows(app, AuditLogRow):
        dump = json.dumps([a.action, a.actor_id, a.target_id, a.meta])
        assert plain not in dump and bare not in dump
    ev = audit_rows(app, "return_code.issue")
    assert len(ev) == 1 and ev[0].actor_id == "user-marina" and ev[0].target_type == "claim" and ev[0].target_id == CLAIM
    assert ev[0].meta == {"itemId": ITEM}

    # nada mais devolve o código: GET do dono, do admin, claim/item/lista
    outputs = [
        client.get(f"/claims/{CLAIM}/return-code", headers=marina), client.get(f"/claims/{CLAIM}/return-code", headers=admin),
        client.get(f"/claims/{CLAIM}", headers=marina), client.get("/claims/mine", headers=marina),
        client.get(f"/items/{ITEM}", headers=admin), client.get(f"/items/{ITEM}", headers=marina),
        client.get("/returns", headers=admin), client.get("/me/export", headers=marina),
        client.get("/admin/audit", headers=admin),
    ]
    for o in outputs:
        assert o.status_code == 200, o.text
        assert plain not in o.text and bare not in o.text


def test_alphabet_has_no_ambiguous_characters_and_codes_are_random():
    assert rc.ALPHABET == "23456789ABCDEFGHJKMNPQRSTVWXYZ" and not set("01OILU") & set(rc.ALPHABET)
    codes = {rc.generate_code() for _ in range(200)}
    assert len(codes) == 200 and all(len(c) == 8 and set(c) <= set(rc.ALPHABET) for c in codes)
    assert rc.format_code("K7M29QXB") == "K7M2-9QXB"


def test_normalize_and_hash_are_bound_to_the_claim():
    assert rc.normalize_code(" k7m2-9 qxb\n") == "K7M29QXB"
    assert rc.normalize_code(None) == "" and rc.normalize_code(123) == "" and rc.normalize_code("  - ") == ""
    h = rc.hash_code("segredo-a", "claim-04", "K7M29QXB")
    assert re.fullmatch(r"[0-9a-f]{64}", h)
    assert h != rc.hash_code("segredo-a", "claim-01", "K7M29QXB")  # exclusivo da devolução
    assert h != rc.hash_code("segredo-b", "claim-04", "K7M29QXB")
    assert rc.code_matches("segredo-a", "claim-04", "K7M29QXB", h) and not rc.code_matches("segredo-a", "claim-04", "K7M29QXC", h)


def test_audit_never_keeps_a_code_field():
    assert audit.clean_metadata({"code": "K7M29QXB", "codigo": "x", "itemId": "i", "codeVerified": True}) == {"itemId": "i", "codeVerified": True}
    assert audit.clean_metadata({"codeVerified": "K7M29QXB"}) is None  # a exceção vale só para booleano


# ---------- (3) GET nunca traz o código ----------
def test_owner_get_shape_after_issue(client, marina):
    issued = client.post(f"/claims/{CLAIM}/return-code", headers=marina).json()
    got = client.get(f"/claims/{CLAIM}/return-code", headers=marina)
    assert got.status_code == 200 and got.headers["cache-control"] == "no-store"
    assert got.json() == {"issued": True, "issuedAt": issued["issuedAt"]}


def test_admin_get_shape(client, admin, marina):
    assert admin_status(client, admin) == {
        "issued": False, "issuedAt": None, "verified": False, "verifiedAt": None, "verifiedUntil": None,
        "attemptsLeft": 5, "lockedUntil": None,
    }
    code = issue_return_code(client, marina, CLAIM)
    s = admin_status(client, admin)
    assert s["issued"] is True and s["verified"] is False and s["attemptsLeft"] == 5
    assert code not in json.dumps(s) and set(s) == {"issued", "issuedAt", "verified", "verifiedAt", "verifiedUntil", "attemptsLeft", "lockedUntil"}


# ---------- (4) quem NÃO é o dono ----------
@pytest.mark.parametrize("who", ["rafael", "lucas", "beatriz", "external"])  # rafael criou o item; lucas teve claim recusada
def test_other_users_cannot_issue_or_read(client, app, request, who):
    headers = login(client, "external") if who == "external" else request.getfixturevalue(who)
    r = client.post(f"/claims/{CLAIM}/return-code", headers=headers)
    assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN"
    assert client.get(f"/claims/{CLAIM}/return-code", headers=headers).status_code == 403
    assert rows(app) == []


def test_visitor_and_admin_cannot_issue(client, app, admin):
    r = client.post(f"/claims/{CLAIM}/return-code", headers={})
    assert r.status_code == 401
    assert client.get(f"/claims/{CLAIM}/return-code").status_code == 401
    r = client.post(f"/claims/{CLAIM}/return-code", headers=admin)
    assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN"
    assert rows(app) == []


def test_changing_the_url_id_or_body_gives_no_access(client, app, marina):
    # claim-01 é de Beatriz; claim-08 também; o corpo não escolhe o dono
    assert client.post("/claims/claim-01/return-code", headers=marina).status_code == 403
    assert client.post("/claims/claim-08/return-code", headers=marina).status_code == 403
    r = client.post("/claims/claim-01/return-code", json={"claimantId": "user-marina"}, headers=marina)
    assert r.status_code == 403
    assert client.get("/claims/claim-01/return-code", headers=marina).status_code == 403
    assert client.post("/claims/claim-xx/return-code", headers=marina).status_code == 404
    assert rows(app) == []


def test_unverified_email_is_not_a_barrier_to_issue(client, app):
    # sem confirmação de e-mail o papel/estado é o que vale: quem não é o dono da reivindicação segue com 403 FORBIDDEN
    make_user(app, "novo@exemplo.com", role="user", verified=False)
    h = token_of(client, "novo@exemplo.com")
    r = client.post(f"/claims/{CLAIM}/return-code", headers=h)
    assert r.status_code == 403 and r.json()["code"] == "FORBIDDEN"


# ---------- (5) antes da aprovação / fora de estado ----------
def test_pending_rejected_or_returned_claims_have_no_code(client, app, marina, beatriz):
    msg = "Só reivindicações aceitas, de itens aguardando devolução, têm código de retirada."
    for headers, claim in ((marina, "claim-06"), (marina, "claim-03"), (beatriz, "claim-01"), (beatriz, "claim-08")):
        r = client.post(f"/claims/{claim}/return-code", headers=headers)
        assert r.status_code == 409, claim
        assert r.json() == {"code": "INVALID_TRANSITION", "message": msg}
    assert rows(app) == []


# ---------- (6) verificar ----------
@pytest.mark.parametrize("fmt", [lambda c: c, lambda c: c.lower(), lambda c: c.replace("-", ""), lambda c: f" {c[:2]} {c[2:4]}-{c[5:]} "])
def test_verify_accepts_normalized_input(client, app, admin, marina, fmt):
    code = issue_return_code(client, marina, CLAIM)
    r = verify(client, admin, fmt(code))
    assert r.status_code == 200
    body = r.json()
    assert body["verified"] is True and body["attemptsLeft"] == 5 and body["lockedUntil"] is None
    assert body["verifiedAt"] == "2026-10-22T15:00:00.000Z" and body["verifiedUntil"] == "2026-10-22T15:15:00.000Z"
    row = code_row(app)
    assert row.verified_at == FIXED_NOW and row.verified_by_id == "user-admin" and row.used_at is None
    assert client.get(f"/items/{ITEM}", headers=admin).json()["item"]["status"] == "under_claim"  # conferir não devolve
    assert rows(app, ReturnRow) and len(rows(app, ReturnRow)) == 2  # só as 2 devoluções do seed
    ev = audit_rows(app, "return_code.verify")
    assert len(ev) == 1 and ev[0].actor_id == "user-admin" and ev[0].target_id == CLAIM


def test_verify_preconditions(client, admin, marina):
    r = verify(client, admin, "AAAA-AAAA")
    assert r.status_code == 409 and r.json() == {
        "code": "INVALID_TRANSITION",
        "message": "A pessoa ainda não gerou o código de retirada. Peça para ela gerar em Minhas reivindicações."}
    assert verify(client, admin, "AAAA-AAAA", claim="claim-01").status_code == 409  # pendente
    assert verify(client, admin, "AAAA-AAAA", claim="claim-08").json()["code"] == "ITEM_RETURNED"
    assert verify(client, admin, "AAAA-AAAA", claim="claim-xx").status_code == 404


# ---------- (7) incorreto ----------
def test_wrong_code_counts_attempts(client, app, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    bad = wrong_of(code)
    for left in (4, 3, 2, 1):
        r = verify(client, admin, bad)
        assert r.status_code == 422 and r.json()["code"] == "VALIDATION"
        assert r.json()["fieldErrors"] == {"code": f"Código incorreto. Restam {left} tentativa(s)."}
        assert bad not in r.text.replace(r.json()["fieldErrors"]["code"], "")
    assert admin_status(client, admin)["attemptsLeft"] == 1
    assert code_row(app).verified_at is None


def test_empty_code_is_a_form_error_and_does_not_count(client, admin, marina):
    issue_return_code(client, marina, CLAIM)
    for body in ({"code": ""}, {"code": "  - "}, {}, {"code": None}, {"code": 12345678}):
        r = client.post(f"/claims/{CLAIM}/return-code/verify", json=body, headers=admin)
        assert r.status_code == 422 and r.json()["fieldErrors"] == {"code": "Informe o código de retirada."}, body
    assert client.post(f"/claims/{CLAIM}/return-code/verify", headers=admin).status_code == 422  # sem corpo
    assert admin_status(client, admin)["attemptsLeft"] == 5


def test_malformed_non_empty_code_counts_as_incorrect(client, admin, marina):
    issue_return_code(client, marina, CLAIM)
    r = verify(client, admin, "123")
    assert r.status_code == 422 and r.json()["fieldErrors"]["code"] == "Código incorreto. Restam 4 tentativa(s)."
    r = verify(client, admin, "x" * 5000)
    assert r.status_code == 422 and "Restam 3" in r.json()["fieldErrors"]["code"]


# ---------- (8) bloqueio ----------
def test_five_failures_lock_and_the_right_code_is_refused_until_it_expires(client, app, clock, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    bad = wrong_of(code)
    for _ in range(4):
        assert verify(client, admin, bad).status_code == 422
    r = verify(client, admin, bad)  # 5ª falha
    assert r.status_code == 429 and r.json()["code"] == "RATE_LIMITED"
    assert r.json()["message"] == "Muitas tentativas incorretas. Aguarde 15 minuto(s) para tentar de novo."
    assert r.headers["retry-after"] == "900"
    row = code_row(app)
    assert row.locked_until == FIXED_NOW + timedelta(seconds=900) and row.failed_attempts == 0
    st = admin_status(client, admin)
    assert st["attemptsLeft"] == 0 and st["lockedUntil"] == "2026-10-22T15:15:00.000Z"

    ok = verify(client, admin, code)  # certo, mas bloqueado
    assert ok.status_code == 429 and code_row(app).verified_at is None
    clock.advance(seconds=600)
    ok = verify(client, admin, code)
    assert ok.status_code == 429 and ok.headers["retry-after"] == "300" and "5 minuto(s)" in ok.json()["message"]

    # regenerar não destrava
    new = issue_return_code(client, marina, CLAIM)
    assert verify(client, admin, new).status_code == 429
    assert code_row(app).locked_until == FIXED_NOW + timedelta(seconds=900)

    clock.advance(seconds=301)
    st = admin_status(client, admin)
    assert st["lockedUntil"] is None and st["attemptsLeft"] == 5
    assert verify(client, admin, new).status_code == 200
    kinds = [a.action for a in audit_rows(app) if a.action.startswith("return_code.")]
    assert kinds.count("return_code.failure") == 5 and kinds.count("return_code.locked") == 1 and kinds[-1] == "return_code.verify"
    failures = audit_rows(app, "return_code.failure")
    assert [f.meta["attemptsLeft"] for f in failures] == [4, 3, 2, 1, 0]
    assert all(f.actor_id == "user-admin" and f.target_id == CLAIM for f in failures)
    assert audit_rows(app, "return_code.locked")[0].meta == {"itemId": ITEM, "lockedSeconds": 900}
    for a in rows(app, AuditLogRow):
        assert bad not in json.dumps(a.meta) and code not in json.dumps(a.meta) and new not in json.dumps(a.meta)


def test_failed_attempts_survive_regeneration_and_reset_on_success(client, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    verify(client, admin, wrong_of(code)); verify(client, admin, wrong_of(code))
    new = issue_return_code(client, marina, CLAIM)
    assert admin_status(client, admin)["attemptsLeft"] == 3  # regenerar mantém as falhas
    assert verify(client, admin, new).status_code == 200
    assert admin_status(client, admin)["attemptsLeft"] == 5


def test_concurrent_wrong_guesses_cannot_exceed_the_limit(client, app, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    bad = wrong_of(code)
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: verify(client, admin, bad).status_code, range(8)))
    assert sorted(results) == [422] * 4 + [429] * 4
    assert code_row(app).locked_until is not None


# ---------- (9) reuso ----------
def test_code_is_single_use(client, app, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    assert verify(client, admin, code).status_code == 200
    done = client.post(f"/items/{ITEM}/return", headers=admin)
    assert done.status_code == 201
    row = code_row(app)
    assert row.used_at == FIXED_NOW and row.verified_at == FIXED_NOW
    r = verify(client, admin, code)
    assert r.status_code == 409 and r.json()["code"] == "ITEM_RETURNED"
    assert client.post(f"/items/{ITEM}/return", headers=admin).json()["code"] == "ITEM_RETURNED"
    assert client.post(f"/claims/{CLAIM}/return-code", headers=marina).status_code == 409  # não gera de novo
    st = admin_status(client, admin)
    assert st["verified"] is False  # usado: a conferência não vale mais


# ---------- (10) papéis em verify e em return ----------
def test_only_admin_can_verify_or_return(client, marina, rafael):
    code = issue_return_code(client, marina, CLAIM)
    ext = login(client, "external")
    for h in (marina, rafael, ext):
        assert verify(client, h, code).status_code == 403
        assert client.post(f"/items/{ITEM}/return", headers=h).status_code == 403
    assert verify(client, {}, code).status_code == 401
    assert client.post(f"/items/{ITEM}/return").status_code == 401
    assert client.get(f"/items/{ITEM}", headers=marina).json()["item"]["status"] == "under_claim"


def test_verify_and_return_require_2fa_like_other_admin_routes(strict_client, strict_app):
    make_user(strict_app, "chefe@exemplo.com")
    h = token_of(strict_client, "chefe@exemplo.com")
    r = strict_client.post(f"/claims/{CLAIM}/return-code/verify", json={"code": "AAAA-AAAA"}, headers=h)
    assert r.status_code == 403 and r.json()["code"] == "TWO_FACTOR_REQUIRED"
    assert strict_client.get(f"/claims/{CLAIM}/return-code", headers=h).json()["code"] == "TWO_FACTOR_REQUIRED"


# ---------- (11) confirmar sem validar / validação vencida ----------
def test_return_without_verification_is_refused(client, app, admin, marina):
    msg = {"code": "INVALID_TRANSITION", "message": "Valide o código de retirada antes de confirmar a entrega."}
    r = client.post(f"/items/{ITEM}/return", headers=admin)  # nem gerado
    assert r.status_code == 409 and r.json() == msg
    issue_return_code(client, marina, CLAIM)
    r = client.post(f"/items/{ITEM}/return", headers=admin)  # gerado, não conferido
    assert r.status_code == 409 and r.json() == msg
    assert client.get(f"/items/{ITEM}", headers=admin).json()["item"]["status"] == "under_claim"
    assert len(rows(app, ReturnRow)) == 2 and code_row(app).used_at is None


def test_wrong_code_never_unlocks_the_return(client, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    verify(client, admin, wrong_of(code))
    assert client.post(f"/items/{ITEM}/return", headers=admin).status_code == 409


def test_verification_expires(client, app, clock, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    assert verify(client, admin, code).status_code == 200
    clock.advance(seconds=899)
    assert admin_status(client, admin)["verified"] is True
    clock.advance(seconds=2)
    st = admin_status(client, admin)
    assert st["verified"] is False and st["verifiedAt"] is not None
    r = client.post(f"/items/{ITEM}/return", headers=admin)
    assert r.status_code == 409 and r.json()["message"] == "A conferência do código expirou. Valide o código novamente."
    assert len(rows(app, ReturnRow)) == 2 and code_row(app).used_at is None
    assert verify(client, admin, code).status_code == 200  # valida de novo
    assert client.post(f"/items/{ITEM}/return", headers=admin).status_code == 201


# ---------- (12) devolução duplicada ----------
def test_duplicate_return_sequential_and_concurrent(client, app, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    assert verify(client, admin, code).status_code == 200
    first = client.post(f"/items/{ITEM}/return", headers=admin)
    second = client.post(f"/items/{ITEM}/return", headers=admin)
    assert (first.status_code, second.status_code) == (201, 409) and second.json()["code"] == "ITEM_RETURNED"
    assert len([r for r in rows(app, ReturnRow) if r.item_id == ITEM]) == 1


def test_concurrent_return_creates_exactly_one_record(client, app, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    assert verify(client, admin, code).status_code == 200
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(lambda _: client.post(f"/items/{ITEM}/return", headers=admin), range(6)))
    codes = sorted(r.status_code for r in results)
    assert codes == [201] + [409] * 5
    assert {r.json()["code"] for r in results if r.status_code == 409} == {"ITEM_RETURNED"}
    assert len([r for r in rows(app, ReturnRow) if r.item_id == ITEM]) == 1
    assert len(audit_rows(app, "return.register")) == 1


# ---------- (13) associação ----------
def test_code_of_one_claim_does_not_validate_another(client, app, admin, marina, beatriz):
    assert client.post("/claims/claim-01/accept", headers=admin).status_code == 200  # item-03, Beatriz
    a = issue_return_code(client, marina, CLAIM)
    b = issue_return_code(client, beatriz, "claim-01")
    r = verify(client, admin, a, claim="claim-01")
    assert r.status_code == 422 and "Código incorreto" in r.json()["fieldErrors"]["code"]
    r = verify(client, admin, b, claim=CLAIM)
    assert r.status_code == 422
    assert code_row(app, "claim-01").verified_at is None and code_row(app).verified_at is None
    assert verify(client, admin, b, claim="claim-01").status_code == 200
    # a conferência de uma não libera a devolução da outra
    assert client.post(f"/items/{ITEM}/return", headers=admin).status_code == 409
    done = client.post("/items/item-03/return", headers=admin)
    assert done.status_code == 201 and done.json()["claimId"] == "claim-01" and done.json()["returnedToId"] == "user-beatriz"


def test_new_code_invalidates_the_old_one_and_resets_verification(client, app, admin, marina):
    old = issue_return_code(client, marina, CLAIM)
    assert verify(client, admin, old).status_code == 200
    new = issue_return_code(client, marina, CLAIM)
    assert new != old and len(rows(app)) == 1
    st = admin_status(client, admin)
    assert st["verified"] is False and st["verifiedAt"] is None
    assert client.post(f"/items/{ITEM}/return", headers=admin).status_code == 409  # conferência anterior zerada
    assert verify(client, admin, old).status_code == 422
    assert verify(client, admin, new).status_code == 200


# ---------- (14) auditoria e registro ----------
def test_full_flow_audit_and_return_record(client, app, admin, marina):
    code = issue_return_code(client, marina, CLAIM)
    bad = wrong_of(code)
    verify(client, admin, bad)
    assert verify(client, admin, code).status_code == 200
    done = client.post(f"/items/{ITEM}/return", headers=admin)
    assert done.status_code == 201
    view = done.json()
    assert view["claimId"] == CLAIM and view["returnedToId"] == "user-marina" and view["registeredById"] == "user-admin"
    assert view["returnedAt"] == "2026-10-22T15:00:00.000Z" and view["codeVerifiedAt"] == "2026-10-22T15:00:00.000Z"
    rec = next(r for r in rows(app, ReturnRow) if r.item_id == ITEM)
    assert rec.registered_by_id == "user-admin" and rec.returned_at == FIXED_NOW and rec.claim_id == CLAIM

    seq = [a.action for a in audit_rows(app) if a.action.startswith(("return_code.", "return."))]
    assert seq == ["return_code.issue", "return_code.failure", "return_code.verify", "return.register"]
    reg = audit_rows(app, "return.register")[0]
    assert reg.actor_id == "user-admin" and reg.target_type == "item" and reg.target_id == ITEM
    assert reg.meta == {"returnId": rec.id, "claimId": CLAIM, "codeVerified": True}
    assert audit_rows(app, "return_code.issue")[0].actor_id == "user-marina"
    for a in rows(app, AuditLogRow):
        assert code not in json.dumps(a.meta) and code.replace("-", "") not in json.dumps(a.meta) and bad not in json.dumps(a.meta)


def test_returns_list_shows_code_verified_at_and_null_for_legacy(client, admin, marina):
    assert do_return_flow(client, marina, admin, CLAIM).status_code == 201
    listed = {r["id"]: r for r in client.get("/returns", headers=admin).json()}
    assert listed["return-01"]["codeVerifiedAt"] is None and listed["return-02"]["codeVerifiedAt"] is None  # legado
    new = next(r for r in listed.values() if r["itemId"] == ITEM)
    assert new["codeVerifiedAt"] == "2026-10-22T15:00:00.000Z"
    assert "codeVerifiedAt" not in client.get(f"/items/{ITEM}", headers=admin).json()["returnRecord"]


# ---------- (15) estado final ----------
def test_after_delivery_item_is_returned_and_gone_from_public_search(client, app, admin, marina):
    assert do_return_flow(client, marina, admin, CLAIM).status_code == 201
    assert client.get(f"/items/{ITEM}", headers=admin).json()["item"]["status"] == "returned"
    assert ITEM not in [i["id"] for i in client.get("/items").json()]
    assert client.get(f"/items/{ITEM}").status_code == 404
    assert code_row(app).used_at == FIXED_NOW


def test_deleting_an_item_removes_its_return_codes(client, app, admin, marina):
    issue_return_code(client, marina, CLAIM)
    assert len(rows(app)) == 1
    assert client.delete(f"/items/{ITEM}", headers=admin).status_code == 204
    assert rows(app) == []
    assert client.get(f"/claims/{CLAIM}", headers=admin).status_code == 404


def test_deleting_the_account_discards_the_pending_code(client, app, marina):
    issue_return_code(client, marina, CLAIM)
    r = client.request("DELETE", "/me", json={"password": "demonstracao123"}, headers=marina)
    assert r.status_code == 204, r.text
    assert rows(app) == []


def test_seed_reset_clears_return_codes(client, app, marina):
    from app.seed import seed_database

    issue_return_code(client, marina, CLAIM)
    with app.state.session_factory() as s:
        seed_database(s, app.state.settings, FIXED_NOW)
    assert rows(app) == []


def test_request_bodies_are_not_logged(client, admin, marina, caplog):
    import logging

    code = issue_return_code(client, marina, CLAIM)
    with caplog.at_level(logging.DEBUG):
        verify(client, admin, code)
        verify(client, admin, wrong_of(code))
    assert code not in caplog.text and code.replace("-", "") not in caplog.text
