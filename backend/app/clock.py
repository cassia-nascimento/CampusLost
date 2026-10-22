"""Relógio e datas. Instantes: UTC, precisão de milissegundos, serializados como `...T12:00:00.000Z`."""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, timedelta, tzinfo

_ISO_DATE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})$")


def utc_now() -> datetime:
    """Agora (UTC, naive, truncado a milissegundos): é o formato guardado no banco."""
    return trunc_ms(datetime.now(UTC).replace(tzinfo=None))


def trunc_ms(dt: datetime) -> datetime:
    return dt.replace(microsecond=(dt.microsecond // 1000) * 1000)


def to_iso(dt: datetime | None) -> str | None:
    """datetime naive (UTC) -> `2026-10-22T14:00:00.000Z`."""
    if dt is None:
        return None
    return dt.replace(tzinfo=UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def to_local_date_string(dt: datetime, tz: tzinfo) -> str:
    """Data de calendário (`YYYY-MM-DD`) no fuso configurado de um instante UTC naive."""
    return dt.replace(tzinfo=UTC).astimezone(tz).date().isoformat()


def local_today(now: datetime, tz: tzinfo) -> str:
    return to_local_date_string(now, tz)


def add_days_str(day: str, delta: int) -> str:
    return (date.fromisoformat(day) + timedelta(days=delta)).isoformat()


def is_valid_iso_date(value: str) -> bool:
    """`True` para `YYYY-MM-DD` que existe no calendário (rejeita 2026-02-30)."""
    m = _ISO_DATE.match(value)
    if not m:
        return False
    try:
        date(int(m[1]), int(m[2]), int(m[3]))
    except ValueError:
        return False
    return True


def is_future_date(day: str, today: str) -> bool:
    return day > today
