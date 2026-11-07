"""Four staff roles in requests; approving them remains a super-admin action."""
from alembic import op
import sqlalchemy as sa

revision = '0019_staff_roles'
down_revision = '0018_clinic_join'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('ck_join_role', 'clinic_join_request', type_='check')
    op.create_check_constraint('ck_join_role', 'clinic_join_request',
        "requested_role IN ('operator', 'doctor', 'clinic_admin', 'clinic_admin_doctor')")


def downgrade():
    if op.get_bind().execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM clinic_join_request WHERE requested_role NOT IN ('operator','doctor'))"
    )).scalar():
        raise RuntimeError('Нельзя откатить роли: существуют заявки админов. Сначала нужен совместимый перенос данных.')
    op.drop_constraint('ck_join_role', 'clinic_join_request', type_='check')
    op.create_check_constraint('ck_join_role', 'clinic_join_request', "requested_role IN ('operator', 'doctor')")
