"""B1/3: camada de e-mail. NENHUM destes testes envia e-mail de verdade: o SMTP é simulado."""

from __future__ import annotations

import logging
import smtplib

import pytest
from fastapi.testclient import TestClient

from app.config import ConfigError, load_settings
from app.main import create_app
from app.mailer import ConsoleMailer, MemoryMailer, OutgoingEmail, SmtpMailer, deliver, make_mailer, verification_email
from tests.conftest import FIXED_NOW, Clock, make_settings
from tests.helpers import PASSWORD, signup_payload

MSG = OutgoingEmail("a@exemplo.com", "Assunto", "Corpo com link http://x/y?token=abc", "http://x/y?token=abc")


def test_console_backend_is_default_in_dev_and_logs_the_link_not_the_body(caplog):
    s = load_settings({}, read_dotenv=False)
    assert s.mail_backend == "console" and isinstance(make_mailer(s), ConsoleMailer)
    with caplog.at_level(logging.WARNING, logger="campuslost.mail"):
        ConsoleMailer().send(MSG)
    assert "http://x/y?token=abc" in caplog.text and "a@exemplo.com" in caplog.text


def test_app_with_console_backend_signup_sends_no_email_and_resend_logs_link(tmp_path, caplog):
    with caplog.at_level(logging.WARNING, logger="campuslost.mail"):
        with TestClient(create_app(make_settings(tmp_path), clock=Clock(FIXED_NOW))) as c:
            assert c.post("/auth/signup", json=signup_payload("log@exemplo.com")).status_code == 201
            assert "/verificar-email?token=" not in caplog.text  # cadastro não envia e-mail
            assert c.post("/auth/resend-verification", json={"email": "log@exemplo.com"}, headers={"X-Requested-With": "fetch"}).status_code == 202
    assert "/verificar-email?token=" in caplog.text
    assert PASSWORD not in caplog.text  # nunca loga senha


class FakeSMTP:
    instances: list["FakeSMTP"] = []

    def __init__(self, host, port, timeout=None):
        self.host, self.port, self.timeout, self.calls, self.sent = host, port, timeout, [], []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def ehlo(self):
        self.calls.append("ehlo")

    def starttls(self, context=None):
        assert context is not None  # contexto padrão do ssl (verifica certificado)
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append("login")
        self.credentials = (user, password)

    def send_message(self, msg):
        self.calls.append("send")
        self.sent.append(msg)


@pytest.fixture
def smtp_settings(tmp_path):
    return make_settings(
        tmp_path, mail_backend="smtp", smtp_host="smtp.exemplo.test", smtp_port=2525, smtp_user="apikey",
        smtp_password="SEGREDO-SMTP-123", smtp_from="CampusLost <nao-responda@exemplo.test>",
    )


def test_smtp_backend_uses_starttls_before_login_and_sends(monkeypatch, smtp_settings):
    FakeSMTP.instances.clear()
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    mailer = make_mailer(smtp_settings)
    assert isinstance(mailer, SmtpMailer)
    mailer.send(MSG)
    smtp = FakeSMTP.instances[0]
    assert (smtp.host, smtp.port) == ("smtp.exemplo.test", 2525) and smtp.timeout
    assert smtp.calls.index("starttls") < smtp.calls.index("login") < smtp.calls.index("send")
    assert smtp.credentials == ("apikey", "SEGREDO-SMTP-123")
    out = smtp.sent[0]
    assert out["To"] == "a@exemplo.com" and out["From"].startswith("CampusLost") and out["Subject"] == "Assunto"
    assert "token=abc" in out.get_content()


def test_smtp_without_user_skips_login(monkeypatch, smtp_settings):
    FakeSMTP.instances.clear()
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    SmtpMailer(smtp_settings.with_overrides(smtp_user="")).send(MSG)
    assert "login" not in FakeSMTP.instances[0].calls


def test_smtp_password_never_appears_in_repr_or_logs(monkeypatch, smtp_settings, caplog):
    assert "SEGREDO-SMTP-123" not in repr(smtp_settings) and "SEGREDO-SMTP-123" not in repr(make_mailer(smtp_settings))

    def boom(*a, **k):
        raise smtplib.SMTPAuthenticationError(535, b"bad credentials for SEGREDO-SMTP-123")

    monkeypatch.setattr(smtplib, "SMTP", boom)
    with caplog.at_level(logging.DEBUG):
        deliver(make_mailer(smtp_settings), MSG)  # não propaga
    assert "SEGREDO-SMTP-123" not in caplog.text and "Falha ao enviar" in caplog.text
    assert "SMTP 535" in caplog.text  # o código ajuda a diagnosticar credenciais recusadas


def test_accepted_delivery_is_logged_without_link_or_secret(monkeypatch, smtp_settings, caplog):
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    with caplog.at_level(logging.INFO):
        deliver(make_mailer(smtp_settings), MSG)
    assert "E-mail aceito pelo servidor" in caplog.text
    assert "SEGREDO-SMTP-123" not in caplog.text and (MSG.link or "@@") not in caplog.text


def test_failed_delivery_does_not_break_signup(tmp_path, monkeypatch, smtp_settings):
    monkeypatch.setattr(smtplib, "SMTP", lambda *a, **k: (_ for _ in ()).throw(OSError("rede fora")))
    with TestClient(create_app(smtp_settings.with_overrides(database_url=f"sqlite:///{tmp_path / 'x.db'}"), clock=Clock(FIXED_NOW))) as c:
        assert c.post("/auth/signup", json=signup_payload("falha@exemplo.com")).status_code == 201


def test_env_configuration_and_production_rules():
    env = {"SMTP_HOST": "smtp.x.test", "SMTP_PORT": "465", "SMTP_USER": "u", "SMTP_PASSWORD": "p",
           "SMTP_FROM": "n@x.test", "APP_BASE_URL": "https://app.exemplo.com/", "MAIL_BACKEND": "smtp"}
    s = load_settings(env, read_dotenv=False)
    assert (s.mail_backend, s.smtp_host, s.smtp_port, s.smtp_user, s.smtp_password, s.smtp_from) == ("smtp", "smtp.x.test", 465, "u", "p", "n@x.test")
    assert s.app_base_url == "https://app.exemplo.com"
    assert verification_email(s, "a@b.co", "A", "tok").link == "https://app.exemplo.com/verificar-email?token=tok"
    with pytest.raises(ConfigError):
        load_settings({"MAIL_BACKEND": "smtp"}, read_dotenv=False)  # sem host/remetente
    with pytest.raises(ConfigError):
        load_settings({"MAIL_BACKEND": "pombo"}, read_dotenv=False)
    with pytest.raises(ConfigError):  # console em produção vazaria links no log
        load_settings({"ENV": "production", "SECRET_KEY": "x" * 40, "MAIL_BACKEND": "console"}, read_dotenv=False)
    prod = load_settings({"ENV": "production", "SECRET_KEY": "x" * 40, **env}, read_dotenv=False)
    assert prod.mail_backend == "smtp"


def test_memory_mailer_collects():
    m = MemoryMailer()
    m.send(MSG)
    assert m.sent == [MSG]
