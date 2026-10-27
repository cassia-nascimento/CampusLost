"""Regras puras do "Entrar com Google" institucional (P30). Domínio padrão `undb.edu.br` (hipótese)."""

from __future__ import annotations

import re

DEFAULT_GOOGLE_ALLOWED_DOMAINS: tuple[str, ...] = ("undb.edu.br",)

_LABEL = r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
_DOMAIN_RE = re.compile(rf"^{_LABEL}(?:\.{_LABEL})+$")
_EMAIL_RE = re.compile(rf"^[^\s@]+@({_LABEL}(?:\.{_LABEL})+)$")


def normalize_domain(raw: str) -> str:
    d = raw.strip().lower()
    return d[1:] if d.startswith("@") else d


def is_allowed_google_email(email: object, allowed_domains: tuple[str, ...] | list[str]) -> bool:
    """Domínio exatamente igual a um permitido OU subdomínio dele.
    `evilundb.edu.br` e `undb.edu.br.evil.com` são recusados."""
    if not isinstance(email, str):
        return False
    m = _EMAIL_RE.match(email.strip().lower())
    if not m:
        return False
    domain = m.group(1)
    for raw in allowed_domains:
        d = normalize_domain(raw)
        if not _DOMAIN_RE.match(d):
            continue
        if domain == d or domain.endswith("." + d):
            return True
    return False


INSTITUTIONAL = "institutional"
EXTERNAL = "external"
AFFILIATIONS = (INSTITUTIONAL, EXTERNAL)


def affiliation_for_email(email: object, allowed_domains: tuple[str, ...] | list[str]) -> str:
    """Vínculo pelo DOMÍNIO do e-mail: `institutional` (domínio ou subdomínio permitido) ou `external`.
    Só diz algo sobre o texto do e-mail (que o Google/link de e-mail comprova ser da pessoa); NÃO verifica
    matrícula nem vínculo real com a instituição."""
    return INSTITUTIONAL if is_allowed_google_email(email, allowed_domains) else EXTERNAL


def parse_allowed_domains(raw: str | None) -> tuple[str, ...]:
    parsed = [normalize_domain(p) for p in (raw or "").split(",")]
    parsed = [d for d in parsed if _DOMAIN_RE.match(d)]
    unique = tuple(dict.fromkeys(parsed))
    return unique or DEFAULT_GOOGLE_ALLOWED_DOMAINS


def is_well_formed_email(email: object) -> bool:
    """Formato `parte-local@dominio.tld` (rótulos válidos). Não diz nada sobre o domínio ser institucional."""
    return isinstance(email, str) and _EMAIL_RE.match(email.strip().lower()) is not None
