"""Общие ссылки подключения и заявки сотрудников.
Revision ID: 0018_clinic_join
Revises: 0017_clinic_mixed
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = '0018_clinic_join'
down_revision = '0017_clinic_mixed'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clinic_membership', sa.Column('is_operator', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.drop_constraint('clinic_membership_role_check', 'clinic_membership', type_='check')
    op.create_check_constraint('clinic_membership_role_check', 'clinic_membership',
                               'is_clinic_admin OR is_doctor OR is_operator')
    op.add_column('service_user', sa.Column('clinic_join_restricted', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('registration_pending', sa.Column('clinic_join_context', postgresql.JSONB(), nullable=True))
    op.create_table('clinic_join_link',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clinic.id'), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False, unique=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('service_user.id'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.TIMESTAMP(timezone=True)))
    op.create_index('ix_clinic_join_link_clinic_id', 'clinic_join_link', ['clinic_id'])
    op.create_index('uq_clinic_join_link_active', 'clinic_join_link', ['clinic_id'], unique=True, postgresql_where=sa.text('revoked_at IS NULL'))
    op.create_table('clinic_join_request',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clinic.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('service_user.id'), nullable=False),
        sa.Column('requested_role', sa.String(20), nullable=False),
        sa.Column('specialization_ids', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('reviewed_at', sa.TIMESTAMP(timezone=True)),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('service_user.id')),
        sa.CheckConstraint("requested_role IN ('operator', 'doctor')", name='ck_join_role'),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected')", name='ck_join_status'))
    op.create_index('ix_clinic_join_request_clinic_id', 'clinic_join_request', ['clinic_id'])
    op.create_index('ix_clinic_join_request_user_id', 'clinic_join_request', ['user_id'])
    op.create_index('uq_clinic_join_pending', 'clinic_join_request', ['clinic_id','user_id'], unique=True, postgresql_where=sa.text("status = 'pending'"))


def downgrade():
    populated = op.get_bind().execute(sa.text("""
        SELECT EXISTS (SELECT 1 FROM clinic_join_request)
        OR EXISTS (SELECT 1 FROM clinic_join_link WHERE revoked_at IS NULL)
        OR EXISTS (SELECT 1 FROM clinic_membership WHERE is_operator)
        OR EXISTS (SELECT 1 FROM service_user WHERE clinic_join_restricted)
        OR EXISTS (SELECT 1 FROM registration_pending WHERE clinic_join_context IS NOT NULL)
    """)).scalar()
    if populated:
        raise RuntimeError('Откат запрещён: сохраните и явно очистите данные подключения сотрудников')
    op.drop_table('clinic_join_request')
    op.drop_table('clinic_join_link')
    op.drop_column('registration_pending', 'clinic_join_context')
    op.drop_column('service_user', 'clinic_join_restricted')
    op.drop_constraint('clinic_membership_role_check', 'clinic_membership', type_='check')
    op.drop_column('clinic_membership', 'is_operator')
    op.create_check_constraint('clinic_membership_role_check', 'clinic_membership',
                               'is_clinic_admin OR is_doctor')
