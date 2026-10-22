from __future__ import annotations

from dataclasses import dataclass

from ..errors import ServiceError


@dataclass(frozen=True)
class Decision:
    allowed: bool
    code: str | None = None
    message: str | None = None

    def to_json(self) -> dict:
        if self.allowed:
            return {"allowed": True}
        return {"allowed": False, "code": self.code, "message": self.message}


ALLOW = Decision(True)


def deny(code: str, message: str) -> Decision:
    return Decision(False, code, message)


def assert_allowed(decision: Decision) -> None:
    if not decision.allowed:
        raise ServiceError(decision.code or "FORBIDDEN", decision.message or "")
