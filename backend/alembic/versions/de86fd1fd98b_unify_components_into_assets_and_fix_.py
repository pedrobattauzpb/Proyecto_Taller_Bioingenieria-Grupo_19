"""unify_components_into_assets_and_fix_evidence

Revision ID: de86fd1fd98b
Revises: f228caf3e508
Create Date: 2026-09-12 16:26:12.686221

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de86fd1fd98b'
down_revision: Union[str, None] = 'f228caf3e508'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Remover FK y columna component_id de inspections PRIMERO
    with op.batch_alter_table('inspections', schema=None) as batch_op:
        batch_op.drop_constraint('fk_inspections_component_id', type_='foreignkey')
        batch_op.drop_column('component_id')

    # 2. Agregar columnas de componente a assets
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('serial_number', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('installation_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('qr_code', sa.String(length=255), nullable=True))
        batch_op.create_index(batch_op.f('ix_assets_qr_code'), ['qr_code'], unique=True)
        batch_op.create_index(batch_op.f('ix_assets_serial_number'), ['serial_number'], unique=False)

    # 3. Modificar uploaded_by a String en inspection_evidences
    with op.batch_alter_table('inspection_evidences', schema=None) as batch_op:
        batch_op.alter_column('uploaded_by',
               existing_type=sa.INTEGER(),
               type_=sa.String(length=255),
               existing_nullable=True)

    # 4. Eliminar índices y tabla components AL FINAL
    with op.batch_alter_table('components', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_components_id'))
        batch_op.drop_index(batch_op.f('ix_components_qr_code'))
        batch_op.drop_index(batch_op.f('ix_components_serial_number'))
        batch_op.drop_index(batch_op.f('ix_components_type'))

    op.drop_table('components')


def downgrade() -> None:
    # 1. Recrear components
    op.create_table('components',
    sa.Column('id', sa.INTEGER(), nullable=False),
    sa.Column('sector_id', sa.INTEGER(), nullable=False),
    sa.Column('type', sa.VARCHAR(length=12), nullable=False),
    sa.Column('serial_number', sa.VARCHAR(length=100), nullable=True),
    sa.Column('installation_date', sa.DATE(), nullable=True),
    sa.Column('qr_code', sa.VARCHAR(length=255), nullable=True),
    sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('components', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_components_type'), ['type'], unique=False)
        batch_op.create_index(batch_op.f('ix_components_serial_number'), ['serial_number'], unique=False)
        batch_op.create_index(batch_op.f('ix_components_qr_code'), ['qr_code'], unique=1)
        batch_op.create_index(batch_op.f('ix_components_id'), ['id'], unique=False)

    # 2. Restaurar component_id en inspections
    with op.batch_alter_table('inspections', schema=None) as batch_op:
        batch_op.add_column(sa.Column('component_id', sa.INTEGER(), nullable=True))
        batch_op.create_foreign_key(batch_op.f('fk_inspections_component_id'), 'components', ['component_id'], ['id'], ondelete='CASCADE')

    # 3. Revertir uploaded_by a INTEGER
    with op.batch_alter_table('inspection_evidences', schema=None) as batch_op:
        batch_op.alter_column('uploaded_by',
               existing_type=sa.String(length=255),
               type_=sa.INTEGER(),
               existing_nullable=True)

    # 4. Remover columnas de assets
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_assets_serial_number'))
        batch_op.drop_index(batch_op.f('ix_assets_qr_code'))
        batch_op.drop_column('qr_code')
        batch_op.drop_column('installation_date')
        batch_op.drop_column('serial_number')
