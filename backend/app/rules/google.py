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


def parse_allowed_domains(raw: str | None) -> tuple[str, ...]:
    parsed = [normalize_domain(p) for p in (raw or "").split(",")]
    parsed = [d for d in parsed if _DOMAIN_RE.match(d)]
    unique = tuple(dict.fromkeys(parsed))
    return unique or DEFAULT_GOOGLE_ALLOWED_DOMAINS
