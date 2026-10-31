"""Поля гастроанкеты. Неотмеченное значение не является отрицанием."""
from __future__ import annotations

from typing import Any


def options(*pairs: tuple[str, str]) -> list[dict[str, str]]:
    return [{"value": value, "label": label} for value, label in pairs]


STATUS = options(("yes", "Да"), ("none", "Нет известных"), ("unknown", "Не знаю"), ("skip", "Пропустить"))
PERIOD = options(("now", "Сейчас / сегодня"), ("past", "Было раньше, сейчас нет"), ("none", "Не было"), ("unknown", "Не уверен(а)"), ("skip", "Пропустить"))
ONSET = options(("days", "Несколько дней"), ("weeks", "Несколько недель"), ("months", "Несколько месяцев"), ("years", "Несколько лет"), ("unknown", "Не помню"))
COMPLAINTS = options(("pain", "Боль в животе"), ("heartburn", "Изжога / обратный заброс"), ("stool", "Изменения стула"), ("nausea", "Тошнота / рвота"), ("swallowing", "Трудности или боль при глотании"), ("fullness", "Вздутие / переполнение / раннее насыщение"), ("jaundice", "Желтизна кожи или глаз"), ("bleeding", "Кровь / чёрный стул"), ("tests", "Обсудить обследования / известный диагноз"), ("other", "Другая причина"), ("none", "Жалоб и отдельных причин нет"))
BRANCHES = ["pain", "heartburn", "stool", "nausea", "swallowing", "fullness", "jaundice", "bleeding"]
RISK_LABELS = {
    "vomit_blood": "Рвота кровью или похожим на кофейную гущу содержимым",
    "black_stool": "Чёрный дегтеобразный стул",
    "heavy_blood": "Обильная кровь со стулом",
    "sudden_severe_pain": "Внезапная сильная боль в животе",
    "cannot_swallow": "Не получается проглотить жидкость или слюну",
    "cannot_drink": "Повторная рвота, не получается удерживать жидкость",
    "fainting": "Обморок или предобморочное состояние на фоне жалоб",
}
RISK_OTHER_LABELS = {"weight_loss": "Снижение веса без намерения похудеть за последние 6 месяцев", "fever": "Повышенная температура вместе с жалобами"}
JAUNDICE_WARNING = "Сейчас: желтизна кожи или глаз. Нужна срочная очная медицинская оценка. Не откладывайте обращение за помощью до завершения анкеты или ответа ИИ."
JAUNDICE_PERIOD = [{**option, **({"warning": JAUNDICE_WARNING} if option["value"] == "now" else {})} for option in PERIOD]


def field(key: str, label: str, type: str = "text", *, opts: list | None = None, **kw: Any) -> dict:
    value = {"key": key, "label": label, "type": type, **kw}
    if opts is not None:
        value["options"] = opts
    if type in {"text", "multiline"}:
        value.setdefault("max_length", 1000)
    return value


def single(key: str, label: str, opts: list = STATUS, **kw: Any) -> dict:
    return field(key, label, "single", opts=opts, **kw)


def multi(key: str, label: str, opts: list, **kw: Any) -> dict:
    return field(key, label, "multi", opts=opts, **kw)


def when(key: str, value: str) -> dict:
    return {"key": key, "value": value}


def detail_fields(key: str, extras: list[dict]) -> list[dict]:
    return [single(f"{key}_onset", "Когда началась именно эта жалоба?", ONSET), field(f"{key}_onset_text", "Свой срок или дата начала (если помните)"), *extras, field(f"{key}_description", "Что ещё важно об этой жалобе?", "multiline")]


def risk_period(key: str, label: str) -> dict:
    opts = options(("now", "Сейчас / сегодня"), ("past", "Было раньше, сейчас нет"), ("unknown", "Не уверен(а)"))
    if key in RISK_LABELS:
        opts[0]["warning"] = f"Сейчас: {label}. Не ждите заполнения анкеты или ответа ИИ. Обратитесь за неотложной медицинской помощью; при выраженном ухудшении вызовите скорую помощь."
    return single(key, f"{label}: когда?", opts, show_when=when("risk_present", key))


FIELDS: dict[str, list[dict]] = {
    "gastro_reason": [multi("complaints", "С чем вы хотите обратиться? Можно несколько причин", COMPLAINTS, required=True, exclusive_values=["none"]), single("symptoms_today", "Есть ли симптомы сегодня?", options(("yes", "Да"), ("no", "Сегодня нет, но хочу обсудить прошлые жалобы"), ("unknown", "Не уверен(а)"))), field("reason_text", "Своя причина визита", "multiline")],
    "gastro_pain": detail_fields("pain", [multi("pain_site", "Где болит?", options(("upper", "Вверху живота"), ("lower", "Внизу живота"), ("right", "Справа"), ("left", "Слева"), ("diffuse", "По всему животу"))), single("pain_intensity", "Какая обычно боль?", options(("mild", "Слабая"), ("moderate", "Умеренная"), ("strong", "Сильная"), ("unknown", "Трудно сказать"))), multi("pain_relation", "С чем связана боль?", options(("food", "С едой"), ("stool", "Со стулом"), ("night", "Будит ночью"), ("unknown", "Не заметил(а)")), exclusive_values=["unknown"])]),
    "gastro_heartburn": detail_fields("heartburn", [multi("heartburn_features", "Что бывает?", options(("burn", "Жжение за грудиной"), ("regurgitation", "Кислое / горькое во рту"), ("night", "Ночью / лёжа"))), single("heartburn_frequency", "Как часто?", options(("rare", "Реже раза в неделю"), ("weekly", "Несколько раз в неделю"), ("daily", "Ежедневно"), ("unknown", "Трудно сказать")))]),
    "gastro_stool": detail_fields("stool", [multi("stool_patterns", "Какие изменения стула бывают? Можно отметить оба", options(("constipation", "Запор"), ("diarrhea", "Жидкий стул"), ("alternating", "Чередование"), ("other", "Другое"))), field("stool_frequency", "Как часто и что изменилось по сравнению с обычным?"), multi("stool_features", "Что замечали?", options(("night", "Стул ночью"), ("antibiotics", "Началось после антибиотиков"), ("travel", "После поездки / необычной еды"), ("mucus", "Слизь")))]),
    "gastro_nausea": detail_fields("nausea", [multi("nausea_features", "Что бывает?", options(("nausea", "Тошнота"), ("vomiting", "Рвота"))), field("vomiting_frequency", "Как часто бывает рвота, если она есть?")]),
    "gastro_swallowing": detail_fields("swallowing", [single("swallow_difficulty", "Бывает ли трудно проглотить?"), single("swallow_pain", "Бывает ли боль при глотании?"), multi("swallow_food", "С чем возникают трудности?", options(("solid", "Твёрдая пища"), ("liquid", "Жидкость"), ("unknown", "Трудно сказать")), exclusive_values=["unknown"])]),
    "gastro_fullness": detail_fields("fullness", [multi("fullness_features", "Что беспокоит?", options(("bloating", "Вздутие"), ("fullness", "Переполнение после еды"), ("early", "Быстро насыщаюсь")))]),
    "gastro_jaundice": detail_fields("jaundice", [single("jaundice_period", "Желтизна кожи или глаз", JAUNDICE_PERIOD), multi("jaundice_features", "Что ещё замечали?", options(("dark_urine", "Тёмная моча"), ("pale_stool", "Светлый стул"), ("itch", "Зуд"), ("fever", "Повышенная температура")))]),
    "gastro_bleeding": detail_fields("bleeding", [single("bleeding_period", "Когда замечали кровь или чёрный стул?", PERIOD), multi("bleeding_features", "Что именно замечали?", options(("red", "Алая кровь"), ("dark", "Тёмная кровь"), ("black", "Чёрный стул"), ("iron", "Принимаю железо"), ("bismuth", "Принимаю висмут"))), field("bleeding_amount", "Сколько и как часто? Если трудно оценить, так и напишите")]),
    "gastro_safety": [multi("risk_present", "Что из этого было или есть? Отмечайте только известные вам признаки", options(*list(RISK_LABELS.items()), *list(RISK_OTHER_LABELS.items()), ("none", "Ничего из перечисленного"), ("unknown", "Не уверен(а)"), ("skip", "Пропустить")), exclusive_values=["none", "unknown", "skip"]), *[risk_period(key, label) for key, label in {**RISK_LABELS, **RISK_OTHER_LABELS}.items()]],
    "gastro_medications": [single("medication_status", "Принимаете ли сейчас лекарства или добавки?"), field("current_medications", "Текущие препараты, дозы и как принимаете (если знаете)", "multiline", show_when=when("medication_status", "yes")), field("stopped_attempts", "Что уже пробовали и явно прекратили принимать? Как помогло?", "multiline"), multi("recent_exposures", "За последние 3 месяца принимали?", options(("antibiotics", "Антибиотики"), ("nsaids", "Обезболивающие (НПВП)"), ("anticoagulants", "Препараты для разжижения крови"), ("iron", "Железо"), ("bismuth", "Висмут"), ("none", "Ничего из перечисленного"), ("unknown", "Не знаю")), exclusive_values=["none", "unknown"])],
    "gastro_allergy": [single("allergy_status", "Есть ли известные аллергии или реакции на лекарства?"), field("allergy_substance", "На что была реакция?", show_when=when("allergy_status", "yes")), field("allergy_reaction", "Какая была реакция? Если не помните, напишите об этом", "multiline", show_when=when("allergy_status", "yes"))],
    "gastro_health": [single("chronic_status", "Есть ли известные хронические болезни?"), field("chronic_diseases", "Какие заболевания?", "multiline", show_when=when("chronic_status", "yes")), single("surgery_status", "Были ли операции?"), field("surgeries", "Какие операции и когда, если помните?", "multiline", show_when=when("surgery_status", "yes")), single("pregnancy", "Беременность (если к вам относится)", options(("known", "Известная беременность"), ("possible", "Возможна"), ("no", "Нет"), ("not_applicable", "Не относится ко мне"), ("unknown", "Не знаю"), ("skip", "Пропустить")))],
    "gastro_family": [multi("family_conditions", "Известно ли о таких болезнях у кровных родственников?", options(("digestive_cancer", "Рак органов пищеварения"), ("polyps", "Полипы кишечника"), ("crohn", "Болезнь Крона"), ("uc", "Язвенный колит"), ("coeliac", "Целиакия"), ("none", "Ничего из этого не известно"), ("unknown", "Не знаю семейную историю"), ("skip", "Пропустить")), exclusive_values=["none", "unknown", "skip"]), *[field(f"family_{key}_relation", f"{label}: у кого из родственников?", show_when=when("family_conditions", key)) for key, label in [("digestive_cancer", "Рак органов пищеварения"), ("polyps", "Полипы"), ("crohn", "Болезнь Крона"), ("uc", "Язвенный колит"), ("coeliac", "Целиакия")]]],
    "gastro_tests": [single("tests_status", "Есть ли обследования или результаты, которые хотите обсудить?"), field("tests_results", "Какие обследования, когда, что в результатах?", "multiline", show_when=when("tests_status", "yes")), single("diagnosis_status", "Есть ли уже установленный диагноз по этой проблеме?"), field("known_diagnoses", "Диагноз по вашим словам", "multiline", show_when=when("diagnosis_status", "yes"))],
    "gastro_history": [single("history_mode", "Хотите подробнее рассказать историю проблемы?", options(("skip", "Пропустить"), ("narrative", "Рассказать своими словами"), ("guided", "По коротким подсказкам"))), field("history_narrative", "История своими словами — можно длинным текстом", "multiline", max_length=20000, show_when=when("history_mode", "narrative")), *[field(key, label, "multiline", max_length=20000, show_when=when("history_mode", "guided")) for key, label in [("history_examinations", "Какие обследования проходили и когда, если помните?"), ("history_treatments", "Как лечились раньше? Что продолжаете, а что прекратили?"), ("history_outcomes", "Что помогло или не помогло? Были ли реакции?"), ("history_changes", "Что изменилось и что хотите обсудить сейчас?")]]],
    "gastro_identity": [field("first_name", "Имя", required=True, max_length=255), field("middle_name", "Отчество (необязательно)", max_length=255), field("appointment_date", "Дата приёма", "date", required=True)],
    "gastro_questions": [field("patient_questions", "Какие вопросы вы обязательно хотите обсудить с врачом?", "list", max_length=20000, help="Необязательно. Добавляйте свои вопросы в нужном порядке; они будут переданы врачу дословно.")],
    "gastro_review": [], "gastro_ai_offer": [], "gastro_ai_wait": [],
}

TITLES = {"gastro_reason": "Причина визита", "gastro_main": "Главная причина", "gastro_safety": "Важные признаки и когда они были", "gastro_medications": "Лекарства сейчас и прошлые попытки", "gastro_allergy": "Аллергии и реакции", "gastro_health": "Болезни и операции", "gastro_family": "Семейная история", "gastro_tests": "Обследования и известные диагнозы", "gastro_history": "История проблемы — по желанию", "gastro_identity": "Имя и дата приёма", "gastro_review": "Проверьте ответы", "gastro_questions": "Вопросы пациента врачу", "gastro_ai_offer": "Необязательное уточнение", "gastro_ai_wait": "Готовим необязательное уточнение", "gastro_ai_question": "Необязательное уточнение"}
