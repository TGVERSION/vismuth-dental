from fastapi import FastAPI

from . import models  # noqa: F401
from .routers.auth import router as auth_router
from .routers.dictionaries import router as dictionaries_router
from .routers.mkb10 import router as mkb10_router
from .routers.ml_autocomplete import router as ml_autocomplete_router
from .routers.ml_clinrec_check import router as ml_clinrec_check_router
from .routers.ml_mkb_code import router as ml_mkb_code_router
from .routers.ml_fullness import router as ml_fullness_router
from .routers.protocol_fields_main import router as protocol_fields_main_router
from .routers.protocols import router as protocols_router
from .routers.protocol_structures import router as protocol_structures_router
from .routers.protocol_templates import router as protocol_templates_router
from .routers.service_user import router as service_user_router
from .routers.template_groups import router as template_groups_router
from .routers.ml_autocomplete_dict import router as ml_complete_router
from .routers.user_settings import router as user_settings_router
from .routers.roles import router as roles_router
from .routers.super_admin.clinics import router as super_admin_clinics_router
from .routers.super_admin.statistics import router as super_admin_statistics_router
from .routers.clinic_admin import router as clinic_admin_router
from .routers.public_questionnaire import router as public_questionnaire_router
from .routers.questionnaires import router as questionnaires_router
from .routers.clinrec_guidelines import router as clinrec_guidelines_router


app = FastAPI(
    title="Vismuth Clinical Decision Support",
    description=(
        ""
    ),
    openapi_tags=[
        {
            "name": "system",
            "description": "Служебные проверки доступности.",
        },
        {
            "name": "auth",
            "description": "Регистрация, логин, refresh/logout (cookie), приглашения в клинику.",
        },
        {
            "name": "service_user",
            "description": "Профиль текущего пользователя и CRUD service_user (privileged).",
        },
        {
            "name": "roles",
            "description": "Справочник ролей для UI (name + name_ru).",
        },
        {
            "name": "user-settings",
            "description": "Настройки пользователя (тема, язык и т.п.).",
        },
        {
            "name": "super-admin-clinics",
            "description": "CRUD клиник и invites. Только роль super_admin.",
        },
        {
            "name": "super-admin-statistics",
            "description": "Сводная статистика анкет по всем клиникам. Только super_admin.",
        },
        {
            "name": "clinic-admin",
            "description": "Админка клиники: профиль, участники, invites, статистика анкет.",
        },
        {
            "name": "public-questionnaire",
            "description": "Публичная анкета пациента без JWT. Headers: X-Device-Id, X-Questionnaire-Token.",
        },
        {
            "name": "questionnaires",
            "description": "Анкеты для врача: список, детали, повторная ML-обработка, создание протокола.",
        },
        {
            "name": "protocols",
            "description": "Клинические протоколы пользователя.",
        },
        {
            "name": "protocol-structures",
            "description": "Каталог структур протоколов и их полей.",
        },
        {
            "name": "protocol-fields-main",
            "description": "Справочник основных полей протоколов.",
        },
        {
            "name": "protocol-templates",
            "description": "Шаблоны протоколов (личные / общие).",
        },
        {
            "name": "template-groups",
            "description": "Группы шаблонов протоколов.",
        },
        {
            "name": "dictionaries",
            "description": "Реестр справочников и поиск по ref_* таблицам.",
        },
        {
            "name": "mkb10",
            "description": "Поиск диагнозов МКБ-10.",
        },
        {
            "name": "ml_mkb_code",
            "description": "ML-proxy: подбор кода МКБ по описанию.",
        },
        {
            "name": "ml_autocomplete",
            "description": "ML-proxy: автодополнение полей протокола.",
        },
        {
            "name": "clinrec",
            "description": "Каталог клинических рекомендаций: CRUD, resolve, индексация.",
        },
        {
            "name": "ml_clinrec_check",
            "description": "ML-proxy: проверка соответствия клиническим рекомендациям.",
        },
        {
            "name": "ml_fullness",
            "description": "ML-proxy: оценка полноты жалоб.",
        },
        {
            "name": "autocomplete_dict",
            "description": "Автодополнение по словарю (без ML-токенов подписки).",
        },
    ],
)

app.include_router(auth_router)
app.include_router(dictionaries_router)
app.include_router(mkb10_router)
app.include_router(ml_autocomplete_router)
app.include_router(ml_clinrec_check_router)
app.include_router(ml_mkb_code_router)
app.include_router(ml_fullness_router)
app.include_router(service_user_router)
app.include_router(roles_router)
app.include_router(template_groups_router)
app.include_router(protocol_templates_router)
app.include_router(protocol_structures_router)
app.include_router(protocol_fields_main_router)
app.include_router(protocols_router)
app.include_router(ml_complete_router)
app.include_router(user_settings_router)
app.include_router(super_admin_clinics_router)
app.include_router(super_admin_statistics_router)
app.include_router(clinic_admin_router)
app.include_router(public_questionnaire_router)
app.include_router(questionnaires_router)
app.include_router(clinrec_guidelines_router)


@app.get("/health", tags=["system"], summary="Health check")
async def health_check():
    return {"status": "ok"}
