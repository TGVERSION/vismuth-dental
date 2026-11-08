"""Independent clinic button color; existing brand_color remains logo background."""
from alembic import op
import sqlalchemy as sa

revision = '0020_clinic_button_color'
down_revision = '0019_staff_roles'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('clinic', sa.Column('button_color', sa.String(7), nullable=True))


def downgrade():
    # An old application can ignore the additive column, but dropping configured
    # colors would lose a user setting. Refuse destructive downgrade in that case.
    if op.get_bind().execute(sa.text('SELECT EXISTS (SELECT 1 FROM clinic WHERE button_color IS NOT NULL)')).scalar():
        raise RuntimeError('Сохранены отдельные цвета кнопок. Используйте совместимый выпуск без удаления настройки.')
    op.drop_column('clinic', 'button_color')
