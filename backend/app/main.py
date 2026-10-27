"""Aplicação FastAPI. `uvicorn app.main:app --reload --port 8000`."""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .clock import utc_now
from .config import Settings, load_settings
from .db import make_engine, make_session_factory
from .errors import ServiceError
from .models import Base
from .mailer import Mailer, make_mailer
from .routers import admin, auth, catalog, claims, demo, items, me, returns, twofa
from .security import RateLimiter
from .schema_check import ensure_schema_current
from .seed import is_empty, seed_database

log = logging.getLogger("campuslost")


class BodyLimitMiddleware:
    """Recusa corpos acima de `max_bytes` (413), pelo Content-Length e contando os bytes recebidos."""

    def __init__(self, app, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        multipart = headers.get(b"content-type", b"").startswith(b"multipart/")

        async def too_large():
            err = ServiceError(
                "PHOTO_INVALID" if multipart else "VALIDATION",
                "A foto passa de 10 MB. Escolha uma menor." if multipart else "A requisição é grande demais.",
                status_code=413,
            )
            await JSONResponse(err.body(), status_code=413)(scope, receive, send)

        declared = headers.get(b"content-length")
        if declared is not None:
            try:
                if int(declared) > self.max_bytes:
                    return await too_large()
            except ValueError:
                pass

        state = {"seen": 0, "exceeded": False, "started": False}

        async def limited_receive():
            message = await receive()
            if message["type"] == "http.request":
                state["seen"] += len(message.get("body", b""))
                if state["seen"] > self.max_bytes:
                    state["exceeded"] = True
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message):
            if state["exceeded"]:
                return
            if message["type"] == "http.response.start":
                state["started"] = True
            await send(message)

        await self.app(scope, limited_receive, guarded_send)
        if state["exceeded"] and not state["started"]:
            await too_large()


NO_STORE_PREFIXES = ("/auth", "/me", "/admin")


class SecurityHeadersMiddleware:
    """Cabeçalhos de segurança em toda resposta: nosniff, X-Frame-Options DENY, Referrer-Policy, `Cache-Control:
    no-store` em /auth, /me e /admin (respostas com sessão/dados pessoais) e HSTS fora de dev/teste. Nunca sobrescreve
    um cabeçalho que a rota já definiu."""

    def __init__(self, app, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def wrapped(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {k.lower() for k, _ in headers}
                path = scope.get("path", "")
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                ]
                if any(path == p or path.startswith(p + "/") for p in NO_STORE_PREFIXES):
                    extra.append((b"cache-control", b"no-store"))
                if self.hsts:
                    extra.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                headers += [(k, v) for k, v in extra if k not in present]
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, wrapped)


def create_app(
    settings: Settings | None = None, clock: Callable[[], datetime] | None = None, mailer: Mailer | None = None
) -> FastAPI:
    settings = settings or load_settings()
    engine = make_engine(settings)
    if not settings.is_production:
        # Dev/testes: cria as tabelas na hora. Em produção o esquema vem só do Alembic (`alembic upgrade head`).
        Base.metadata.create_all(engine)
    ensure_schema_current(engine)  # banco antigo (colunas/tabelas faltando): falha na subida, com instruções; não altera nada
    session_factory = make_session_factory(engine)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    app = FastAPI(title="CampusLost API", version="1.0.0", docs_url="/docs" if not settings.is_production else None, redoc_url=None, openapi_url="/openapi.json" if not settings.is_production else None)
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.clock = clock or utc_now
    app.state.write_lock = threading.RLock()
    app.state.mailer = mailer or make_mailer(settings)
    # Só para rotas de e-mail/medidor de senha, por IP (memória, 1 processo). O limite de LOGIN fica no banco.
    app.state.mail_limiter = RateLimiter(auth.MAIL_IP_LIMIT, 3600)
    app.state.strength_limiter = RateLimiter(auth.STRENGTH_IP_LIMIT, 3600)  # medidor chamado enquanto a pessoa digita

    if settings.seed_on_startup and settings.demo_mode:
        with session_factory() as s:
            if is_empty(s):
                seed_database(s, settings, app.state.clock())
                log.info("Banco vazio: seed de demonstração aplicado.")

    # Ordem: o último adicionado fica mais externo.
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.env not in ("development", "test"))
    app.add_middleware(BodyLimitMiddleware, max_bytes=settings.max_body_bytes)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
        allow_credentials=True,  # cookies de sessão (origens explícitas, nunca "*")
    )

    @app.exception_handler(ServiceError)
    async def _service_error(_: Request, exc: ServiceError):
        return JSONResponse(exc.body(), status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        fields: dict[str, str] = {}
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path")]
            fields.setdefault(".".join(loc) or "_form", "Valor inválido.")
        body = ServiceError("VALIDATION", "Confira os campos destacados.", fields).body()
        return JSONResponse(body, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            err = ServiceError("NOT_FOUND", "Recurso não encontrado.")
        elif exc.status_code in (400, 413):
            err = ServiceError("VALIDATION", "Requisição inválida.", status_code=exc.status_code)
        elif exc.status_code == 401:
            err = ServiceError("UNAUTHENTICATED", "Entre na sua conta para continuar.")
        elif exc.status_code == 403:
            err = ServiceError("FORBIDDEN", "Você não tem permissão para realizar esta ação.")
        else:
            err = ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.", status_code=exc.status_code)
        return JSONResponse(err.body(), status_code=err.status_code, headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def _unexpected(request: Request, exc: Exception):
        # Nunca devolve detalhes internos ao cliente; o registro fica só no log do servidor.
        log.exception("Erro não tratado em %s %s", request.method, request.url.path, exc_info=exc)
        return JSONResponse(ServiceError("UNEXPECTED", "Algo deu errado. Tente novamente.").body(), status_code=500)

    @app.get("/health", tags=["health"])
    def health():
        return {"status": "ok"}

    for r in (auth.router, twofa.router, admin.router, me.router, catalog.router, items.router, claims.router, returns.router, demo.router):
        app.include_router(r)

    app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")
    return app


_app: FastAPI | None = None


def __getattr__(name: str):
    """`uvicorn app.main:app` cria a aplicação sob demanda (importar o módulo não toca no banco)."""
    global _app
    if name == "app":
        if _app is None:
            _app = create_app()
        return _app
    raise AttributeError(name)
