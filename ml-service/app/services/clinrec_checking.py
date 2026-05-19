from langchain_core.messages import SystemMessage, HumanMessage
from .llm_setup import llm_clinrec, clinrec_collection
import json
from ..schemas.clinrec import ClinicalAnalysis


def build_human_prompt(protocol_text: str, retrieved_chunks: list) -> HumanMessage:
    """Формирует HumanMessage из протокола и релевантных чанков"""
    guidelines_text = "\n\n".join([
        f"[{i+1}] {chunk}" for i, chunk in enumerate(retrieved_chunks)
    ])
    
    human_prompt = f"""
Клинические рекомендации (релевантные фрагменты):
{guidelines_text}

Протокол врача (разбит по полям):
{protocol_text}

Проанализируй соответствие протокола клиническим рекомендациям. Верни JSON.
"""
    return HumanMessage(content=human_prompt)


def retrieve_chunks(query_fields: list = None, n_results: int = 3) -> list:
    """
    Извлекает релевантные чанки из векторной БД по списку полей.
    Возвращает список уникальных чанков.
    """
    if query_fields is None:
        query_fields = ['Рекомендации', 'Медикаменты в настоящее время', 'Назначения']
    
    retrieved_chunks = []
    
    for field in query_fields:
        results = clinrec_collection.query(query_texts=[field], n_results=n_results)
        retrieved_chunks.extend(results['documents'][0])
    
    # Удаляем дубликаты
    unique_chunks = []
    seen = set()
    for chunk in retrieved_chunks:
        if chunk not in seen:
            seen.add(chunk)
            unique_chunks.append(chunk)
    
    return unique_chunks


def get_clinrec_checking(protocol_text: str) -> ClinicalAnalysis:
    """
    Основная функция: извлекает чанки, отправляет в LLM, возвращает результат.
    
    Args:
        protocol_text: склеенный текст протокола
    
    Returns:
        dict: JSON из ответа LLM
    """
    system_prompt = """
Ты — медицинский эксперт по клиническим рекомендациям. Анализируешь протокол врача на соответствие переданным фрагментам клинреков.

Правила:
1. Используй ТОЛЬКО переданные фрагменты клинреков.
2. Пустое поле протокола = замечание только если клинрек ТРЕБУЕТ.
3. Различай "не задокументировано" (warning) и "нарушено" (critical).
4. Максимум 10 замечаний. Приоритет клинической значимости.
5. В поле guideline_quote — дословная цитата из клинрека.

Уровни severity:
- critical: явное нарушение обязательного требования
- warning: рекомендация не выполнена, но допустимо
- info: полезно, но не обязательно

Формат ответа (строго JSON):
{
"severity_counts": {"critical": 0, "warning": 0, "info": 0},
"findings": [
{
"severity": "critical|warning|info",
"section": "Название раздела протокола",
"issue": "Что не так",
"recommendation": "Как исправить",
"guideline_ref": "Заголовок раздела клинрека",
"guideline_quote": "Дословная цитата"
}
],
"compliant_sections": ["список полей", "которые соответствуют"]
}

Если замечаний нет: findings = [], severity_counts все 0.
"""

    # 1. Извлекаем чанки
    unique_chunks = retrieve_chunks()
    
    # 2. Формируем промпт
    human_msg = build_human_prompt(protocol_text, unique_chunks)
    
    # 3. Отправляем в LLM с STRUCTURED OUTPUT
    structured_llm = llm_clinrec.with_structured_output(ClinicalAnalysis)
    
    messages = [
        SystemMessage(content=system_prompt),
        human_msg
    ]
    
    # Получаем структурированный объект
    result: ClinicalAnalysis = structured_llm.invoke(messages)
    
    # Возвращаем как dict для совместимости с эндпоинтом
    return result