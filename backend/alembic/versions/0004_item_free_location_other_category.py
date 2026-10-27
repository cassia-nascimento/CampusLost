"""local livre, categoria 'Outros' especificada e local de guarda opcional

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-27 18:00:00

Upgrade (sem apagar nem alterar dados): items.found_location String(40) -> String(120); items.stored_at passa a
aceitar NULL (local de guarda opcional); nova coluna items.category_detail String(40) NULL (especificação da
categoria "Outros"). Registros existentes ficam intactos.

Downgrade: items.stored_at NULL vira "Não informado" antes de voltar a NOT NULL; items.found_location é truncado a 40
caracteres se necessário; items.category_detail e DESCARTADA (a informação dela se perde).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('category_detail', sa.String(length=40), nullable=True))
        batch_op.alter_column('found_location', existing_type=sa.String(length=40), type_=sa.String(length=120), existing_nullable=False)
        batch_op.alter_column('stored_at', existing_type=sa.String(length=120), nullable=True)


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("UPDATE items SET stored_at = 'Não informado' WHERE stored_at IS NULL"))
    conn.execute(sa.text("UPDATE items SET found_location = substr(found_location, 1, 40) WHERE length(found_location) > 40"))
    with op.batch_alter_table('items', schema=None) as batch_op:
        batch_op.alter_column('stored_at', existing_type=sa.String(length=120), nullable=False)
        batch_op.alter_column('found_location', existing_type=sa.String(length=120), type_=sa.String(length=40), existing_nullable=False)
        batch_op.drop_column('category_detail')
