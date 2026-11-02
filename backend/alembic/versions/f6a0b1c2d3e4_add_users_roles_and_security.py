"""add_users_roles_and_security

Revision ID: f6a0b1c2d3e4
Revises: e1a2b3c4d5e6
Create Date: 2026-11-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a0b1c2d3e4'
down_revision: Union[str, None] = 'e1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_AUDIT_EVENTS = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'TOKEN_REFRESH_REUSE_DETECTED',
    'ACCOUNT_LOCKED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET',
    'USER_CREATED',
    'USER_UPDATED',
    'USER_ROLE_CHANGED',
    'USER_DEACTIVATED',
    'USER_ACTIVATED',
    'USER_SCOPE_CHANGED',
    'ACCESS_DENIED',
    'INSPECTION_STARTED',
    'EVIDENCE_DELETED',
]


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1. Ampliar enum auditeventtype en PostgreSQL
    if dialect == "postgresql":
        with op.get_context().autocommit_block():
            for val in NEW_AUDIT_EVENTS:
                op.execute(sa.text(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{val}'"))

    # 2. Crear tabla users
    user_role_enum = sa.Enum('TECHNICIAN', 'SUPERVISOR', 'AUDITOR', 'ADMIN', name='userrole')
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('professional_license', sa.String(length=50), nullable=True),
        sa.Column('role', user_role_enum, nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1' if dialect == 'sqlite' else 'true')),
        sa.Column('has_global_scope', sa.Boolean(), nullable=False, server_default=sa.text('0' if dialect == 'sqlite' else 'false')),
        sa.Column('must_change_password', sa.Boolean(), nullable=False, server_default=sa.text('1' if dialect == 'sqlite' else 'true')),
        sa.Column('failed_login_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_until', sa.DateTime(), nullable=True),
        sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_login_at', sa.DateTime(), nullable=True),
        sa.Column('password_changed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 3. Crear tabla user_hospitals
    op.create_table(
        'user_hospitals',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id', 'hospital_id'),
    )

    # 4. Crear tabla refresh_tokens
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=128), nullable=False),
        sa.Column('family_id', sa.String(length=36), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('replaced_by_id', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(['replaced_by_id'], ['refresh_tokens.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_refresh_tokens_id'), 'refresh_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_token_hash'), 'refresh_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_refresh_tokens_family_id'), 'refresh_tokens', ['family_id'], unique=False)

    # 5. Modificar inspections
    with op.batch_alter_table('inspections', schema=None) as batch_op:
        batch_op.add_column(sa.Column('completed_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_inspections_inspector_id', 'users', ['inspector_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_inspections_completed_by_id', 'users', ['completed_by_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_inspections_inspector_id', ['inspector_id'], unique=False)

    # 6. Modificar inspection_evidences
    with op.batch_alter_table('inspection_evidences', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uploaded_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_inspection_evidences_uploaded_by_id', 'users', ['uploaded_by_id'], ['id'], ondelete='SET NULL')

    # 7. Modificar alerts
    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('acknowledged_by_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('resolved_by_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_alerts_acknowledged_by_id', 'users', ['acknowledged_by_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_alerts_resolved_by_id', 'users', ['resolved_by_id'], ['id'], ondelete='SET NULL')

    # 8. Modificar audit_logs
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('actor_user_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('ip_address', sa.String(length=45), nullable=True))
        batch_op.add_column(sa.Column('user_agent', sa.String(length=255), nullable=True))
        batch_op.create_foreign_key('fk_audit_logs_actor_user_id', 'users', ['actor_user_id'], ['id'], ondelete='SET NULL')
        batch_op.create_index('ix_audit_logs_actor_user_id', ['actor_user_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1. Revertir audit_logs
    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_audit_logs_actor_user_id')
        batch_op.drop_constraint('fk_audit_logs_actor_user_id', type_='foreignkey')
        batch_op.drop_column('user_agent')
        batch_op.drop_column('ip_address')
        batch_op.drop_column('actor_user_id')

    # 2. Revertir alerts
    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.drop_constraint('fk_alerts_resolved_by_id', type_='foreignkey')
        batch_op.drop_constraint('fk_alerts_acknowledged_by_id', type_='foreignkey')
        batch_op.drop_column('resolved_by_id')
        batch_op.drop_column('acknowledged_by_id')

    # 3. Revertir inspection_evidences
    with op.batch_alter_table('inspection_evidences', schema=None) as batch_op:
        batch_op.drop_constraint('fk_inspection_evidences_uploaded_by_id', type_='foreignkey')
        batch_op.drop_column('uploaded_by_id')

    # 4. Revertir inspections
    with op.batch_alter_table('inspections', schema=None) as batch_op:
        batch_op.drop_index('ix_inspections_inspector_id')
        batch_op.drop_constraint('fk_inspections_completed_by_id', type_='foreignkey')
        batch_op.drop_constraint('fk_inspections_inspector_id', type_='foreignkey')
        batch_op.drop_column('completed_by_id')

    # 5. Dropear refresh_tokens
    op.drop_index(op.f('ix_refresh_tokens_family_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_token_hash'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')

    # 6. Dropear user_hospitals
    op.drop_table('user_hospitals')

    # 7. Dropear users
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_table('users')

    if dialect == 'postgresql':
        op.execute(sa.text("DROP TYPE IF EXISTS userrole"))
