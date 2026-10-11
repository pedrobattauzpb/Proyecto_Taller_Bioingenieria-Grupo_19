"""add_notifications_and_alerts

Revision ID: e1a2b3c4d5e6
Revises: de86fd1fd98b
Create Date: 2026-10-11 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a2b3c4d5e6'
down_revision: Union[str, None] = 'de86fd1fd98b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # 1. Ampliar enum auditeventtype en PostgreSQL
    if dialect == "postgresql":
        with op.get_context().autocommit_block():
            for val in [
                'ALERT_RAISED',
                'ALERT_ACKNOWLEDGED',
                'ALERT_RESOLVED',
                'ALERT_ESCALATED',
                'ALERT_SILENCED',
            ]:
                op.execute(sa.text(f"ALTER TYPE auditeventtype ADD VALUE IF NOT EXISTS '{val}'"))

    # 2. Agregar columnas a assets
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hydraulic_test_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('inspection_interval_days', sa.Integer(), nullable=True))

    # 3. Agregar columna a checklist_templates
    with op.batch_alter_table('checklist_templates', schema=None) as batch_op:
        batch_op.add_column(sa.Column('default_interval_days', sa.Integer(), nullable=True))

    # 4. Crear tabla alerts
    op.create_table(
        'alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('fingerprint', sa.String(length=64), nullable=False),
        sa.Column('rule_code', sa.String(length=50), nullable=False),
        sa.Column(
            'source',
            sa.Enum('COMPLIANCE', 'SCHEDULER', 'INSPECTION_LIFECYCLE', 'NORMATIVE', 'MANUAL', name='alertsource'),
            nullable=False
        ),
        sa.Column(
            'severity',
            sa.Enum('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', name='alertseverity'),
            nullable=False
        ),
        sa.Column(
            'status',
            sa.Enum('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'AUTO_RESOLVED', 'SILENCED', name='alertstatus'),
            nullable=False
        ),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('normative_ref', sa.String(length=150), nullable=True),
        sa.Column(
            'scope_type',
            sa.Enum('INSPECTION', 'ASSET', 'TEMPLATE', 'NORMATIVE', 'SYSTEM', name='alertscopetype'),
            nullable=False
        ),
        sa.Column('hospital_id', sa.Integer(), nullable=True),
        sa.Column('sector_id', sa.Integer(), nullable=True),
        sa.Column('asset_id', sa.Integer(), nullable=True),
        sa.Column('inspection_id', sa.Integer(), nullable=True),
        sa.Column('item_id', sa.Integer(), nullable=True),
        sa.Column('template_id', sa.Integer(), nullable=True),
        sa.Column('expected_value', sa.String(length=255), nullable=True),
        sa.Column('actual_value', sa.String(length=255), nullable=True),
        sa.Column('context', sa.JSON(), nullable=True),
        sa.Column('is_provisional', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('occurrence_count', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('first_detected_at', sa.DateTime(), nullable=False),
        sa.Column('last_detected_at', sa.DateTime(), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_by', sa.String(length=255), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', sa.String(length=255), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('escalation_level', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_escalated_at', sa.DateTime(), nullable=True),
        sa.Column('silenced_until', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['inspection_id'], ['inspections.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['item_id'], ['checklist_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['template_id'], ['checklist_templates.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_alerts_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_fingerprint'), ['fingerprint'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_rule_code'), ['rule_code'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_severity'), ['severity'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_hospital_id'), ['hospital_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_sector_id'), ['sector_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_asset_id'), ['asset_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_inspection_id'), ['inspection_id'], unique=False)

    # 5. Crear tabla notification_channels
    op.create_table(
        'notification_channels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('channel_type', sa.Enum('IN_APP', 'EMAIL', 'WEBHOOK', name='channeltype'), nullable=False),
        sa.Column('target', sa.String(length=500), nullable=False),
        sa.Column('min_severity', sa.Enum('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', name='alertseverity'), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=True),
        sa.Column('sector_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('secret', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sector_id'], ['sectors.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('notification_channels', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notification_channels_id'), ['id'], unique=False)

    # 6. Crear tabla alert_rules
    op.create_table(
        'alert_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rule_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('severity_override', sa.Enum('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', name='alertseverity'), nullable=True),
        sa.Column('params', sa.JSON(), nullable=True),
        sa.Column('notify_external', sa.Boolean(), nullable=False, server_default=sa.text('1')),
        sa.Column('escalate_after_minutes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('alert_rules', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_alert_rules_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_alert_rules_rule_code'), ['rule_code'], unique=True)

    # 7. Crear tabla notification_deliveries
    op.create_table(
        'notification_deliveries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('alert_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=True),
        sa.Column('channel_type', sa.Enum('IN_APP', 'EMAIL', 'WEBHOOK', name='channeltype'), nullable=False),
        sa.Column('target', sa.String(length=500), nullable=False),
        sa.Column('event', sa.String(length=30), nullable=False),
        sa.Column(
            'status',
            sa.Enum('PENDING', 'SENT', 'FAILED', 'SKIPPED', name='deliverystatus'),
            nullable=False,
            server_default='PENDING'
        ),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['channel_id'], ['notification_channels.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('notification_deliveries', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notification_deliveries_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_notification_deliveries_alert_id'), ['alert_id'], unique=False)


def downgrade() -> None:
    # 1. Dropear notification_deliveries
    with op.batch_alter_table('notification_deliveries', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notification_deliveries_alert_id'))
        batch_op.drop_index(batch_op.f('ix_notification_deliveries_id'))
    op.drop_table('notification_deliveries')

    # 2. Dropear alert_rules
    with op.batch_alter_table('alert_rules', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_alert_rules_rule_code'))
        batch_op.drop_index(batch_op.f('ix_alert_rules_id'))
    op.drop_table('alert_rules')

    # 3. Dropear notification_channels
    with op.batch_alter_table('notification_channels', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_notification_channels_id'))
    op.drop_table('notification_channels')

    # 4. Dropear alerts
    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_alerts_inspection_id'))
        batch_op.drop_index(batch_op.f('ix_alerts_asset_id'))
        batch_op.drop_index(batch_op.f('ix_alerts_sector_id'))
        batch_op.drop_index(batch_op.f('ix_alerts_hospital_id'))
        batch_op.drop_index(batch_op.f('ix_alerts_status'))
        batch_op.drop_index(batch_op.f('ix_alerts_severity'))
        batch_op.drop_index(batch_op.f('ix_alerts_rule_code'))
        batch_op.drop_index(batch_op.f('ix_alerts_fingerprint'))
        batch_op.drop_index(batch_op.f('ix_alerts_id'))
    op.drop_table('alerts')

    # 5. Dropear columna de checklist_templates
    with op.batch_alter_table('checklist_templates', schema=None) as batch_op:
        batch_op.drop_column('default_interval_days')

    # 6. Dropear columnas de assets
    with op.batch_alter_table('assets', schema=None) as batch_op:
        batch_op.drop_column('inspection_interval_days')
        batch_op.drop_column('hydraulic_test_date')

    # Nota: Los valores agregados al enum en PostgreSQL no se pueden remover limpiamente con ALTER TYPE.
