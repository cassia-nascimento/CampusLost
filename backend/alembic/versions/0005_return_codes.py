"""codigo de retirada da devolucao (return_codes)

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-27 20:00:00

Upgrade: apenas cria a tabela `return_codes` (uma linha por reivindicacao aceita; so o HMAC do codigo e
guardado). Nenhum dado existente e alterado; devolucoes anteriores continuam validas (sem codigo).

Downgrade: remove a tabela (os codigos pendentes se perdem; o proprietario gera outro ao reaplicar).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0005'
down_revision: Union[str, None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('return_codes',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('claim_id', sa.String(length=64), nullable=False),
    sa.Column('item_id', sa.String(length=64), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('issued_at', sa.DateTime(), nullable=False),
    sa.Column('failed_attempts', sa.Integer(), nullable=False),
    sa.Column('locked_until', sa.DateTime(), nullable=True),
    sa.Column('verified_at', sa.DateTime(), nullable=True),
    sa.Column('verified_by_id', sa.String(length=64), nullable=True),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['claim_id'], ['claims.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['item_id'], ['items.id'], ),
    sa.ForeignKeyConstraint(['verified_by_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('claim_id')
    )


def downgrade() -> None:
    op.drop_table('return_codes')
