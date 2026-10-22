"""Seed de demonstração: mesmos ids e dados de `frontend/src/services/mock/seed.ts`.

Todos os dados são FICTÍCIOS. Datas relativas a "hoje" (fuso configurado), como no mock.

    python -m app.seed             # apaga os dados e recria o seed
    python -m app.seed --if-empty  # só semeia se o banco estiver vazio
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import timedelta
from functools import lru_cache

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from .clock import add_days_str, local_today, trunc_ms, utc_now
from .config import Settings, load_settings
from .models import Base, ClaimRow, ItemRow, ReturnRow, UserRow
from .photos import install_seed_images, purge_uploaded_photos
from .security import hash_password

log = logging.getLogger("campuslost.seed")

DEMO_PASSWORD = "demo12345"  # NÃO é segredo: senha pública das contas @demo.test
DEMO_DATA_NOTICE = "Dados fictícios de demonstração (pessoas, itens e locais); não representam o campus real."

DEMO_PROFILE_IDS = {"student": "user-marina", "teacher": "user-rafael", "admin": "user-admin"}
DEMO_PROFILE_LABELS = {
    "student": "Entrar como aluno",
    "teacher": "Entrar como professor",
    "admin": "Entrar como administração",
}

USERS = [
    ("user-marina", "Marina Alves", "marina@demo.test", "student"),
    ("user-rafael", "Rafael Lima", "rafael@demo.test", "teacher"),
    ("user-admin", "Administração Demo", "admin@demo.test", "admin"),
    # Usuários de apoio (autores de reivindicações); não são atalhos de demonstração.
    ("user-lucas", "Lucas Prado", "lucas@demo.test", "student"),
    ("user-beatriz", "Beatriz Nunes", "beatriz@demo.test", "student"),
]

# (n, createdHoursAgo, foundDaysAgo, title, photo, description, category, foundLocation, storedAt, status, createdById)
ITEMS = [
    (1, 3, 0, "Fones de ouvido sem fio", "fones-de-ouvido", "Fones intra-auriculares brancos, com estojo de carregamento pequeno.", "Eletrônicos", "Biblioteca", "Biblioteca", "available", "user-rafael"),
    (2, 26, 1, "Carteira de estudante", "carteira-de-estudante", "Carteira de estudante dentro de uma capinha transparente, encontrada no chão.", "Documentos", "Portaria", "Portaria", "available", "user-admin"),
    (3, 50, 2, "Chaveiro com três chaves", "chaveiro", "Chaveiro de borracha vermelho com três chaves, sendo uma delas de cadeado.", "Chaves", "Bloco A", "Portaria", "under_claim", "user-lucas"),
    (7, 74, 3, "Calculadora científica", "calculadora", "Calculadora científica preta com capa deslizante e arranhões na tampa.", "Eletrônicos", "Bloco A", "Portaria", "under_claim", "user-lucas"),
    (4, 98, 4, "Casaco azul-marinho", "casaco", "Casaco de moletom azul-marinho, tamanho M, com capuz e bolso frontal.", "Roupas", "Cantina", "Portaria", "available", "user-beatriz"),
    (5, 122, 5, "Notebook cinza", "notebook", "Notebook cinza de 14 polegadas, sem capa, com adesivos na tampa.", "Eletrônicos", "Biblioteca", "Portaria", "under_claim", "user-rafael"),
    (6, 146, 6, "Garrafa térmica verde", "garrafa-termica", "Garrafa térmica de aço verde-escuro, 500 ml, com amassado perto da tampa.", "Outros", "Cantina", "Cantina", "available", "user-admin"),
    (8, 194, 8, "Guarda-chuva preto", "guarda-chuva", "Guarda-chuva preto automático com cabo curvo de madeira.", "Outros", "Portaria", "Portaria", "available", "user-marina"),
    (10, 218, 9, "Mochila preta", "mochila", "Mochila preta com zíper azul e um chaveiro de pelúcia pendurado.", "Outros", "Bloco A", "Entregue ao dono", "returned", "user-admin"),
    (9, 266, 11, "Óculos de grau", "oculos", "Óculos de grau com armação preta retangular, dentro de um estojo cinza.", "Outros", "Cantina", "Portaria", "available", "user-rafael"),
    (11, 362, 15, "Carregador USB-C", "carregador", "Carregador de parede branco com cabo USB-C de 1 metro enrolado.", "Eletrônicos", "Biblioteca", "Entregue ao dono", "returned", "user-admin"),
]

# (n, itemN, claimantId, createdHoursAgo, status, reviewedHoursAgo, proofDetails, lostWhereWhen)
CLAIMS = [
    (1, 3, "user-beatriz", 20, "pending", None, "Uma das chaves é de um cadeado de armário e tem um risco de esmalte azul.", "Perdi no Bloco A, ontem à tarde."),
    (2, 3, "user-rafael", 8, "pending", None, "O chaveiro tem uma etiqueta de fita branca com as iniciais RL.", "Provavelmente caiu do meu bolso no Bloco A, ontem."),
    (3, 4, "user-marina", 80, "rejected", 60, "É um casaco azul de moletom.", "Perdi na Cantina na semana passada."),
    (4, 5, "user-marina", 100, "accepted", 40, "O adesivo maior na tampa é de uma banda; a tecla Esc está um pouco solta.", "Esqueci na Biblioteca, no começo da semana passada, de manhã."),
    (5, 5, "user-lucas", 90, "rejected", 40, "Notebook cinza com adesivos.", "Não lembro exatamente, acho que foi na biblioteca."),
    (6, 7, "user-marina", 30, "pending", None, "A capa deslizante está sem um dos cantos e tem meu sobrenome escrito a lápis por dentro.", "Deixei no Bloco A, na terça à tarde."),
    (7, 7, "user-beatriz", 12, "pending", None, "Calculadora preta com arranhões.", "Bloco A, não sei dizer o dia."),
    (8, 10, "user-beatriz", 190, "accepted", 130, "O chaveiro de pelúcia é um gatinho cinza com um olho descosturado.", "Esqueci no Bloco A, em uma aula de manhã."),
    (9, 11, "user-rafael", 330, "accepted", 300, "O cabo tem uma fita isolante preta perto da ponta do conector.", "Deixei ligado na Biblioteca, no fim da tarde."),
]

# (id, itemId, claimId, returnedToId, registeredById, returnedHoursAgo)
RETURNS = [
    ("return-01", "item-10", "claim-08", "user-beatriz", "user-admin", 120),
    ("return-02", "item-11", "claim-09", "user-rafael", "user-admin", 288),
]


@lru_cache(maxsize=8)
def _demo_hash(rounds: int) -> str:
    # Um único hash para as 5 contas (o bcrypt já embute um sal aleatório): evita 5 cálculos a cada reset.
    return hash_password(DEMO_PASSWORD, rounds)


def seed_database(session: Session, settings: Settings, now=None) -> None:
    """Apaga TODAS as linhas e recria o seed. `now`: instante UTC naive (padrão: agora)."""
    now = trunc_ms(now) if now is not None else utc_now()
    today = local_today(now, settings.tz)
    at = lambda hours_ago: now - timedelta(hours=hours_ago)  # noqa: E731
    pw_hash = _demo_hash(settings.bcrypt_rounds)

    for model in (ReturnRow, ClaimRow, ItemRow, UserRow):
        session.execute(delete(model))

    created = at(24 * 30)
    for uid, name, email, role in USERS:
        session.add(
            UserRow(id=uid, name=name, email=email, role=role, provider="password", password_hash=pw_hash, created_at=created)
        )
    session.flush()

    for n, created_h, found_d, title, photo, desc, cat, loc, stored, status, by in ITEMS:
        session.add(
            ItemRow(
                id=f"item-{n:02d}", title=title, description=desc, category=cat, found_location=loc,
                found_date=add_days_str(today, -found_d), stored_at=stored,
                photo_url=f"/uploads/seed/{photo}.svg", status=status, created_by_id=by, created_at=at(created_h),
            )
        )
    session.flush()

    for n, item_n, who, created_h, status, reviewed_h, proof, where in CLAIMS:
        session.add(
            ClaimRow(
                id=f"claim-{n:02d}", item_id=f"item-{item_n:02d}", claimant_id=who, proof_details=proof,
                lost_where_when=where, status=status, created_at=at(created_h),
                reviewed_at=None if reviewed_h is None else at(reviewed_h),
            )
        )
    session.flush()

    for rid, item_id, claim_id, to_id, by_id, hours in RETURNS:
        session.add(
            ReturnRow(id=rid, item_id=item_id, claim_id=claim_id, returned_to_id=to_id, registered_by_id=by_id, returned_at=at(hours))
        )
    session.commit()
    install_seed_images(settings)


def reset_demo(session: Session, settings: Settings, now=None) -> None:
    """Restaura o seed e apaga as fotos enviadas pelos usuários."""
    purge_uploaded_photos(settings)
    seed_database(session, settings, now)


def is_empty(session: Session) -> bool:
    return (session.scalar(select(func.count()).select_from(UserRow)) or 0) == 0


def main(argv: list[str] | None = None) -> int:
    from .db import make_engine, make_session_factory

    parser = argparse.ArgumentParser(description="Popula o banco com os dados de demonstração.")
    parser.add_argument("--if-empty", action="store_true", help="só semeia se não houver usuários")
    parser.add_argument("--force", action="store_true", help="permite semear com ENV=production (cria contas com senha pública!)")
    args = parser.parse_args(argv)

    settings = load_settings()
    if settings.is_production and not args.force:
        print("Recusado: ENV=production. O seed cria contas com senha pública (demo12345). Use --force só se souber o que faz.", file=sys.stderr)
        return 2
    engine = make_engine(settings)
    Base.metadata.create_all(engine)
    with make_session_factory(engine)() as session:
        if args.if_empty and not is_empty(session):
            print("Banco já tem dados; nada a fazer (--if-empty).")
            return 0
        seed_database(session, settings)
    print(f"Seed aplicado em {settings.database_url}. {DEMO_DATA_NOTICE}")
    print("Contas: marina@demo.test (aluno), rafael@demo.test (professor), admin@demo.test (administração); senha demo12345.")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(main())
