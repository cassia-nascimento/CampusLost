"""Cria (ou promove) uma conta de administração: a administração só nasce por script, nunca pelo cadastro.

    python -m app.create_admin --email admin@undb.edu.br --name "Fulana de Tal"
    (a senha é pedida no terminal, ou lida de ADMIN_PASSWORD)
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from .clock import utc_now
from .config import load_settings, random_id
from .db import make_engine, make_session_factory
from .errors import ServiceError
from .models import Base, UserRow
from .rules.validation import normalize_email, validate_signup
from .security import hash_password


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Cria uma conta de administração.")
    p.add_argument("--email", required=True)
    p.add_argument("--name", required=True)
    args = p.parse_args(argv)
    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Senha (8 a 72 caracteres): ")
    try:
        data = validate_signup({"name": args.name, "email": args.email, "password": password, "role": "student"})
    except ServiceError as exc:
        print("Dados inválidos:", exc.field_errors, file=sys.stderr)
        return 2
    settings = load_settings()
    engine = make_engine(settings)
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as s:
        email = normalize_email(data["email"])
        if s.scalar(select(UserRow).where(UserRow.email == email)):
            print("Já existe uma conta com esse e-mail.", file=sys.stderr)
            return 1
        s.add(
            UserRow(
                id=random_id("user"), name=data["name"], email=email, role="admin", provider="password",
                password_hash=hash_password(data["password"], settings.bcrypt_rounds), created_at=utc_now(),
            )
        )
        s.commit()
    print(f"Administração criada: {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
