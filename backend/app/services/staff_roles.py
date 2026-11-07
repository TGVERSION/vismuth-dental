"""One staff-facing role vocabulary; storage flags remain an internal detail."""

STAFF_ROLES = [
    {'value': 'clinic_admin', 'label': 'Админ'},
    {'value': 'clinic_admin_doctor', 'label': 'Админ и врач'},
    {'value': 'doctor', 'label': 'Врач'},
    {'value': 'operator', 'label': 'Оператор контакт-центра / Регистратор'},
]


def staff_role_label(code: str) -> str:
    return next((item['label'] for item in STAFF_ROLES if item['value'] == code), code)
