"""Camada de e-mail (B1/3). Backends: `console` (dev: imprime o link no log) e `smtp` (STARTTLS).

Nunca registre senha: `SMTP_PASSWORD` só é usada no login SMTP e não aparece em log nem em `repr`.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from urllib.parse import quote

from .config import Settings

log = logging.getLogger("campuslost.mail")


@dataclass(frozen=True)
class OutgoingEmail:
    to: str
    subject: str
    text: str
    link: str | None = None  # link de ação (verificação/redefinição), útil para console e testes


class Mailer:
    def send(self, message: OutgoingEmail) -> None:  # pragma: no cover - interface
        raise NotImplementedError


class ConsoleMailer(Mailer):
    """Desenvolvimento: o e-mail não sai da máquina; o link aparece no log do servidor."""

    def send(self, message: OutgoingEmail) -> None:
        log.warning("[e-mail:console] para=%s assunto=%r link=%s", message.to, message.subject, message.link or "-")


class SmtpMailer(Mailer):
    def __init__(self, settings: Settings) -> None:
        self.host, self.port = settings.smtp_host, settings.smtp_port
        self.user, self.password, self.sender = settings.smtp_user, settings.smtp_password, settings.smtp_from

    def __repr__(self) -> str:  # nunca expõe a senha
        return f"SmtpMailer(host={self.host!r}, port={self.port}, user={self.user!r})"

    def send(self, message: OutgoingEmail) -> None:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.sender, message.to, message.subject
        msg.set_content(message.text)
        context = ssl.create_default_context()
        with smtplib.SMTP(self.host, self.port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls(context=context)
            smtp.ehlo()
            if self.user:
                smtp.login(self.user, self.password)
            smtp.send_message(msg)


@dataclass
class MemoryMailer(Mailer):
    """Somente testes: guarda as mensagens enviadas."""

    sent: list[OutgoingEmail] = field(default_factory=list)

    def send(self, message: OutgoingEmail) -> None:
        self.sent.append(message)


def make_mailer(settings: Settings) -> Mailer:
    return SmtpMailer(settings) if settings.mail_backend == "smtp" else ConsoleMailer()


def deliver(mailer: Mailer, message: OutgoingEmail) -> None:
    """Envia sem nunca derrubar a requisição: falhas ficam só no log (sem o corpo da mensagem)."""
    try:
        mailer.send(message)
    except Exception as exc:  # noqa: BLE001 - SMTP pode falhar de várias formas
        log.error("Falha ao enviar e-mail para %s: %s", message.to, type(exc).__name__)


def verification_email(settings: Settings, to: str, name: str, token: str) -> OutgoingEmail:
    link = f"{settings.app_base_url}/verificar-email?token={quote(token)}"
    text = (
        f"Olá, {name}!\n\nConfirme seu e-mail para registrar e reivindicar itens no CampusLost:\n{link}\n\n"
        f"O link vale por {settings.verify_token_hours} horas e só pode ser usado uma vez.\n"
        "Se você não criou uma conta, ignore esta mensagem."
    )
    return OutgoingEmail(to, "Confirme seu e-mail no CampusLost", text, link)


def reset_email(settings: Settings, to: str, name: str, token: str) -> OutgoingEmail:
    link = f"{settings.app_base_url}/redefinir-senha?token={quote(token)}"
    text = (
        f"Olá, {name}!\n\nRecebemos um pedido para redefinir sua senha no CampusLost:\n{link}\n\n"
        f"O link vale por {settings.reset_token_minutes} minutos e só pode ser usado uma vez.\n"
        "Se não foi você, ignore esta mensagem: sua senha continua a mesma."
    )
    return OutgoingEmail(to, "Redefinição de senha no CampusLost", text, link)
