"""B1/5: política de senha (10+ caracteres, <= 72 bytes UTF-8, não comum, não pessoal) e medidor."""

from __future__ import annotations

import pytest

from app.rules.password import common_passwords, password_error, password_strength
from tests.helpers import signup_payload

GOOD = "Cavalo-Bateria-Grampo-7"


def test_common_password_list_has_about_two_hundred_or_more_entries():
    words = common_passwords()
    assert len(words) >= 200 and "password" in words and "senha123" in words and all(w == w.lower() for w in words)


@pytest.mark.parametrize(
    "password, message",
    [
        (None, "Crie uma senha."),
        ("", "Crie uma senha."),
        ("Zq7!mK2#x", "Use pelo menos 10 caracteres."),  # 9
        ("x" * 73, "Use no máximo 72 caracteres."),
        ("é" * 37, "A senha passa de 72 bytes (acentos e emojis ocupam mais de 1 byte). Use uma senha mais curta."),  # 74 bytes
        ("😀" * 19, "A senha passa de 72 bytes (acentos e emojis ocupam mais de 1 byte). Use uma senha mais curta."),  # 76 bytes
        ("1234567890", "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar."),
        ("Password1234", "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar."),  # variação trivial
        ("QWERTYUIOP", "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar."),
        ("!!senha123456!!", "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar."),
        ("aaaaaaaaaaaa", "Evite repetições e sequências óbvias (como aaaaaaaaaa ou 1234567890)."),
        ("ababababababab", "Evite repetições e sequências óbvias (como aaaaaaaaaa ou 1234567890)."),
        ("9876543210", "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar."),
    ],
)
def test_rejected_passwords(password, message):
    assert password_error(password) == message


def test_boundaries_are_accepted():
    assert password_error("Zq7!mK2#xP") is None  # 10 caracteres
    assert password_error("aB3$" * 18) is None  # exatamente 72 bytes
    assert password_error("çãõé" * 9) is None  # 36 caracteres = 72 bytes
    assert password_error(GOOD) is None


def test_password_cannot_equal_email_local_part_or_name():
    assert password_error("maria.silva@exemplo.com", email="Maria.Silva@exemplo.com")
    assert password_error("maria.silva", email="maria.silva@exemplo.com") == "A senha não pode ser igual ao seu e-mail ou ao seu nome."
    assert password_error("MariaSilva", email="x@y.co", name="Maria Silva") == "A senha não pode ser igual ao seu e-mail ou ao seu nome."
    assert password_error("maria silva", email="x@y.co", name="Maria Silva") == "A senha não pode ser igual ao seu e-mail ou ao seu nome."
    assert password_error("MARIA.SILVA@EXEMPLO.COM", email="maria.silva@exemplo.com")
    # pessoal só quando IGUAL: conter o nome no meio de uma frase longa é aceito
    assert password_error("minha-maria-silva-adora-cafe-9", email="maria.silva@exemplo.com", name="Maria Silva") is None


@pytest.mark.parametrize("password, field_message", [
    ("Password1234", "Essa senha é muito comum. Escolha outra, mais difícil de adivinhar."),
    ("joana.exemplo", "A senha não pode ser igual ao seu e-mail ou ao seu nome."),
    ("é" * 37, "A senha passa de 72 bytes (acentos e emojis ocupam mais de 1 byte). Use uma senha mais curta."),
])
def test_signup_applies_the_policy(client, password, field_message):
    r = client.post("/auth/signup", json=signup_payload("joana.exemplo@mail.test", password=password, name="Joana"))
    assert r.status_code == 422 and r.json()["fieldErrors"]["password"] == field_message


def test_signup_accepts_unicode_password_within_72_bytes(client):
    assert client.post("/auth/signup", json=signup_payload("u@exemplo.com", password="çãõ-Pássaro-Água-2026")).status_code == 201


def test_strength_function_scores_and_flags():
    weak = password_strength("123")
    assert weak["ok"] is False and weak["score"] == 0 and weak["label"] == "Muito fraca"
    common = password_strength("Password1234")
    assert common["ok"] is False and common["score"] <= 1
    ok = password_strength("Zq7!mK2#xP")
    assert ok["ok"] is True and ok["score"] >= 1 and ok["error"] is None
    strong = password_strength(GOOD + "-xyz")
    assert strong["ok"] and strong["score"] == 4 and strong["label"] == "Muito forte"
    scores = [password_strength(p)["score"] for p in ("Zq7!mK2#xP", "Zq7!mK2#xPab", "Zq7!mK2#xPabcd", GOOD + "-xyz")]
    assert scores == sorted(scores)


def test_password_strength_endpoint(client):
    r = client.post("/auth/password-strength", json={"password": "Password1234"})
    assert r.status_code == 200 and r.json()["ok"] is False and r.json()["error"].startswith("Essa senha é muito comum")
    r = client.post("/auth/password-strength", json={"password": GOOD})
    assert r.json()["ok"] is True and r.json()["score"] >= 2
    r = client.post("/auth/password-strength", json={"password": "joana@exemplo.com", "email": "Joana@exemplo.com"})
    assert r.json()["ok"] is False
    assert client.post("/auth/password-strength", json={}).json()["ok"] is False
    assert GOOD not in client.post("/auth/password-strength", json={"password": GOOD}).text  # não ecoa a senha


def test_login_does_not_apply_new_password_policy(client):
    """A política vale só para senhas NOVAS; o login não a reaplica."""
    assert client.post("/auth/login", json={"email": "marina@demo.test", "password": "demonstracao123"}).status_code == 200


def test_password_strength_endpoint_has_a_generous_per_ip_limit(client):
    codes = [client.post("/auth/password-strength", json={"password": "abc"}).status_code for _ in range(601)]
    assert codes[:600] == [200] * 600 and codes[600] == 429
