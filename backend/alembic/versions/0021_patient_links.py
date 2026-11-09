"""Persistent opaque patient links for optional appointment selections."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0021_patient_links'
down_revision = '0020_clinic_button_color'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('patient_link',
        sa.Column('slug', sa.String(18), primary_key=True),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clinic.id', ondelete='CASCADE'), nullable=False),
        sa.Column('selection_key', sa.String(64), nullable=False, unique=True),
        sa.Column('selection', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_patient_link_clinic_id', 'patient_link', ['clinic_id'])


def downgrade():
    if op.get_bind().execute(sa.text('SELECT EXISTS (SELECT 1 FROM patient_link)')).scalar():
        raise RuntimeError('Короткие ссылки уже выданы. Используйте совместимый исправляющий выпуск.')
    op.drop_table('patient_link')
