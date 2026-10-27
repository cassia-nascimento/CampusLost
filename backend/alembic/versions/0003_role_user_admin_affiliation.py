"""papel de acesso user|admin + vinculo (affiliation) institutional|external

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-27 12:00:00

Dados: users.role student|teacher|external -> user (admin permanece). affiliation: student|teacher -> institutional,
external -> external, admin -> pelo DOMINIO do e-mail (dominio/subdominio de GOOGLE_ALLOWED_DOMAINS => institutional,
senao external). O vinculo e so o dominio do e-mail, nunca verificado de outra forma.

Downgrade: user+institutional -> student, user+external -> external (a distincao aluno/professor NAO e recuperavel:
vira student); admin permanece; a coluna affiliation e removida.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.config import load_settings
from app.rules.google import affiliation_for_email

revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    domains = load_settings().google_allowed_domains
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('affiliation', sa.String(length=16), nullable=False, server_default='external'))

    conn = op.get_bind()
    conn.execute(sa.text("UPDATE users SET affiliation = 'institutional' WHERE role IN ('student', 'teacher')"))
    conn.execute(sa.text("UPDATE users SET affiliation = 'external' WHERE role = 'external'"))
    for uid, email in conn.execute(sa.text("SELECT id, email FROM users WHERE role = 'admin'")).fetchall():
        conn.execute(
            sa.text("UPDATE users SET affiliation = :a WHERE id = :id"),
            {"a": affiliation_for_email(email, domains), "id": uid},
        )
    conn.execute(sa.text("UPDATE users SET role = 'user' WHERE role IN ('student', 'teacher', 'external')"))

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('affiliation', existing_type=sa.String(length=16), server_default=None, existing_nullable=False)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE users SET role = 'student' WHERE role = 'user' AND affiliation = 'institutional'"))
    conn.execute(sa.text("UPDATE users SET role = 'external' WHERE role = 'user' AND affiliation = 'external'"))
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('affiliation')
