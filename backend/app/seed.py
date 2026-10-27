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
from .models import Base, ClaimRow, EmailTokenRow, ItemRow, LoginAttemptRow, ReturnCodeRow, ReturnRow, SessionRow, UserRow
from .photos import install_seed_images, purge_uploaded_photos
from .security import hash_password

log = logging.getLogger("campuslost.seed")

DEMO_PASSWORD = "demonstracao123"  # NÃO é segredo: senha pública das contas @demo.test
DEMO_DATA_NOTICE = "Dados fictícios de demonstração (pessoas, itens e locais); não representam o campus real."

# Atalhos de demonstração (chave -> usuário do seed): um usuário comum e a administração. Os demais usuários do
# seed (inclusive o externo) existem, mas não são atalhos.
DEMO_PROFILE_IDS = {"user": "user-marina", "admin": "user-admin"}
DEMO_PROFILE_LABELS = {
    "user": "Usuário",
    "admin": "Administração",
}

USERS = [
    ("user-marina", "Marina Alves", "marina@demo.test", "user", "institutional"),
    ("user-rafael", "Rafael Lima", "rafael@demo.test", "user", "institutional"),
    ("user-admin", "Administração Demo", "admin@demo.test", "admin", "institutional"),
    # Usuários de apoio (autores de reivindicações); não são atalhos de demonstração.
    ("user-lucas", "Lucas Prado", "lucas@demo.test", "user", "institutional"),
    ("user-beatriz", "Beatriz Nunes", "beatriz@demo.test", "user", "institutional"),
    # Vínculo externo (e-mail fora do domínio institucional); não é atalho de demonstração.
    ("user-externo", "Visitante Externo", "externo@demo.test", "user", "external"),
]

# (n, createdHoursAgo, foundDaysAgo, title, photo (arquivo em seed_assets, com extensão), description, category, foundLocation (texto livre), storedAt (só admin vê), status, createdById, categoryOther)
ITEMS = [
    (1, 3, 0, "Fones de ouvido sem fio", "fones-de-ouvido.webp", "Fones intra-auriculares brancos, com estojo de carregamento pequeno.", "Eletrônicos", "Biblioteca", "Biblioteca", "available", "user-rafael", None),
    (2, 26, 1, "Boné bege", "bone.webp", "Boné bege com um bordado verde na frente, encontrado no pátio.", "Roupas", "Portaria", "Portaria", "available", "user-admin", None),
    (3, 50, 2, "Chaveiro com três chaves", "chaveiro.webp", "Chaveiro de borracha vermelho com três chaves, sendo uma delas de cadeado.", "Chaves", "Bloco A", "Portaria", "under_claim", "user-lucas", None),
    (7, 74, 3, "Calculadora científica", "calculadora.webp", "Calculadora científica preta com capa deslizante e arranhões na tampa.", "Eletrônicos", "Bloco A", "Portaria", "under_claim", "user-lucas", None),
    (4, 98, 4, "Casaco azul-marinho", "casaco.webp", "Casaco de moletom azul-marinho, tamanho M, com capuz e bolso frontal.", "Roupas", "Cantina", "Portaria", "available", "user-beatriz", None),
    (5, 122, 5, "Notebook cinza", "notebook.webp", "Notebook cinza de 14 polegadas, sem capa, com adesivos na tampa.", "Eletrônicos", "Biblioteca", "Portaria", "under_claim", "user-rafael", None),
    (6, 146, 6, "Garrafa térmica verde", "garrafa-termica.webp", "Garrafa térmica de aço verde-escuro, 500 ml, com amassado perto da tampa.", "Outros", "Cantina", "Cantina", "available", "user-admin", "Garrafa térmica"),
    (8, 194, 8, "Guarda-chuva preto", "guarda-chuva.webp", "Guarda-chuva preto automático com cabo curvo de madeira.", "Outros", "Portaria", "Portaria", "available", "user-marina", "Guarda-chuva"),
    (10, 218, 9, "Mochila preta", "mochila.webp", "Mochila preta com zíper azul e um chaveiro de pelúcia pendurado.", "Outros", "Bloco A", "Entregue ao dono", "returned", "user-admin", "Mochila escolar"),
    (9, 266, 11, "Óculos de grau", "oculos.webp", "Óculos de grau com armação preta retangular, dentro de um estojo cinza.", "Outros", "Cantina", "Portaria", "available", "user-rafael", "Óculos de grau"),
    (11, 362, 15, "Carregador USB-C", "carregador.webp", "Carregador de parede branco com cabo USB-C de 1 metro enrolado.", "Eletrônicos", "Biblioteca", "Entregue ao dono", "returned", "user-admin", None),
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

    # Sessões das contas de demonstração sobrevivem ao reset (quem está logado como perfil demo não é deslogado).
    seed_ids = [u[0] for u in USERS]
    kept_sessions = [
        {c.name: getattr(s, c.name) for c in SessionRow.__table__.columns}
        for s in session.scalars(select(SessionRow).where(SessionRow.user_id.in_(seed_ids)))
    ]
    for model in (ReturnCodeRow, ReturnRow, ClaimRow, ItemRow, SessionRow, EmailTokenRow, LoginAttemptRow, UserRow):
        session.execute(delete(model))

    created = at(24 * 30)
    for uid, name, email, role, affiliation in USERS:
        session.add(
            UserRow(id=uid, name=name, email=email, role=role, affiliation=affiliation, provider="password", password_hash=pw_hash, created_at=created,
                email_verified_at=created, terms_accepted_at=created, terms_version=settings.terms_version,
            )
        )
    session.flush()
    for cols in kept_sessions:
        session.add(SessionRow(**cols))
    session.flush()

    for n, created_h, found_d, title, photo, desc, cat, loc, stored, status, by, cat_detail in ITEMS:
        session.add(
            ItemRow(
                id=f"item-{n:02d}", title=title, description=desc, category=cat, category_detail=cat_detail, found_location=loc,
                found_date=add_days_str(today, -found_d), stored_at=stored,
                photo_url=f"/uploads/seed/{photo}", status=status, created_by_id=by, created_at=at(created_h),
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
        print("Recusado: ENV=production. O seed cria contas com senha pública (demonstracao123). Use --force só se souber o que faz.", file=sys.stderr)
        return 2
    engine = make_engine(settings)
    if not settings.is_production:
        Base.metadata.create_all(engine)
    with make_session_factory(engine)() as session:
        if args.if_empty and not is_empty(session):
            print("Banco já tem dados; nada a fazer (--if-empty).")
            return 0
        seed_database(session, settings)
    print(f"Seed aplicado em {settings.database_url}. {DEMO_DATA_NOTICE}")
    print("Contas: marina@, rafael@, lucas@, beatriz@ demo.test (usuário, vínculo institutional), externo@demo.test (usuário, vínculo external), admin@demo.test (administração); senha demonstracao123.")
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    raise SystemExit(main())
