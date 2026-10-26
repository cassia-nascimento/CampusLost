"""Fixtures: cada teste tem seu próprio banco SQLite temporário, uploads temporários e relógio controlável."""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.mailer import MemoryMailer
from app.main import create_app

# Quarta-feira, 22/10/2026 15:00 UTC (12:00 em Fortaleza). Relógio fixo ⇒ seed determinístico.
FIXED_NOW = datetime(2026, 10, 22, 15, 0, 0)
DEMO_PASSWORD = "demonstracao123"


class Clock:
    def __init__(self, start: datetime) -> None:
        self.t = start

    def __call__(self) -> datetime:
        return self.t

    def advance(self, **kwargs) -> None:
        self.t += timedelta(**kwargs)


def make_settings(tmp_path, **overrides) -> Settings:
    base = dict(
        env="test",
        secret_key="test-secret-key-with-more-than-32-characters!!",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        uploads_dir=tmp_path / "uploads",
        cors_origins=("http://localhost:3000",),
        demo_mode=True,
        seed_on_startup=True,
        google_client_id="test-client-id.apps.googleusercontent.com",
        bcrypt_rounds=4,  # rápido nos testes
        login_rate_limit=10,
        timezone_name="America/Fortaleza",
        cookie_refresh_path="/auth",  # os testes de sessão assumem o escopo estreito; o padrão real é "/" (proxy do Next)
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
def clock() -> Clock:
    return Clock(FIXED_NOW)


@pytest.fixture
def settings(tmp_path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def mailbox() -> MemoryMailer:
    return MemoryMailer()


@pytest.fixture
def app(settings, clock, mailbox):
    return create_app(settings, clock=clock, mailer=mailbox)


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


def login(client: TestClient, role: str) -> dict[str, str]:
    r = client.post(f"/demo/login/{role}")
    assert r.status_code == 200, r.text
    client.cookies.clear()  # os testes autenticam por Bearer; cookies deixariam chamadas "de visitante" logadas
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture
def student(client):
    return login(client, "student")


@pytest.fixture
def teacher(client):
    return login(client, "teacher")


@pytest.fixture
def admin(client):
    return login(client, "admin")


def password_login(client: TestClient, email: str) -> dict[str, str]:
    r = client.post("/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert r.status_code == 200, r.text
    client.cookies.clear()
    return {"Authorization": f"Bearer {r.json()['token']}"}


# Imagens mínimas válidas (assinaturas reais)
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01" + b"\x00" * 64 + b"\xff\xd9"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 64

ITEM_FORM = {
    "title": "Agenda vermelha",
    "description": "Agenda vermelha com elástico e capa dura.",
    "category": "Outros",
    "foundLocation": "Biblioteca",
    "foundDate": "2026-10-21",
    "storedAt": "Portaria",
}


def extract_token(message) -> str:
    """Token em claro do link enviado por e-mail (`?token=...`)."""
    import re

    m = re.search(r"token=([A-Za-z0-9_\-]+)", message.link or message.text)
    assert m, message
    return m.group(1)


# --- B2: 2FA de administração exigido (modo demo mantém o seed, mas a isenção só vale para `user-admin`) ----------
@pytest.fixture
def strict_app(tmp_path, clock, mailbox):
    return create_app(make_settings(tmp_path, admin_require_2fa=True), clock=clock, mailer=mailbox)


@pytest.fixture
def strict_client(strict_app):
    with TestClient(strict_app) as c:
        yield c
