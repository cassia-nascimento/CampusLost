"""Erros tipados. O JSON de erro reaproveita os códigos do frontend (`ServiceErrorCode`)."""

from __future__ import annotations

# Status HTTP por código. `RATE_LIMITED` é o único código que o frontend ainda não tem.
STATUS_BY_CODE: dict[str, int] = {
    "UNAUTHENTICATED": 401,
    "INVALID_CREDENTIALS": 401,
    "FORBIDDEN": 403,
    "FORBIDDEN_DOMAIN": 403,
    "EMAIL_NOT_VERIFIED": 403,
    "CSRF_FAILED": 403,
    "INVALID_TOKEN": 400,
    "CAPTCHA_FAILED": 400,
    "NOT_FOUND": 404,
    "VALIDATION": 422,
    "PHOTO_INVALID": 422,
    "EMAIL_TAKEN": 409,
    "INVALID_TRANSITION": 409,
    "DUPLICATE_CLAIM": 409,
    "CLAIM_BLOCKED": 409,
    "ITEM_RETURNED": 409,
    "CONFLICT": 409,
    "RATE_LIMITED": 429,
    "UNEXPECTED": 500,
}


class ServiceError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        field_errors: dict[str, str] | None = None,
        status_code: int | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field_errors = field_errors
        self.status_code = status_code or STATUS_BY_CODE.get(code, 500)
        self.headers = headers

    def body(self) -> dict:
        out: dict = {"code": self.code, "message": self.message}
        if self.field_errors:
            out["fieldErrors"] = self.field_errors
        return out
