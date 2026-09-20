from langchain_core.messages import SystemMessage, HumanMessage
from .llm_setup import llm_clinrec, clinrec_emb_model, clinrec_collection
from .prompts import CLINREC_SYSTEM_PROMPT, CLINREC_HUMAN_PROMPT_TEMPLATE
import json


def build_human_prompt(protocol_text: str, retrieved_chunks: list) -> HumanMessage:
    """Формирует HumanMessage из протокола и релевантных чанков"""
    guidelines_text = "\n\n".join([
        f"[{i+1}] {chunk}" for i, chunk in enumerate(retrieved_chunks)
    ])
    
    human_prompt = CLINREC_HUMAN_PROMPT_TEMPLATE.format(
        guidelines_text=guidelines_text,
        protocol_text=protocol_text
    )
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


def get_clinrec_checking(protocol_text: str) -> dict:
    """
    Основная функция: извлекает чанки, отправляет в LLM, возвращает результат.
    
    Args:
        protocol_text: склеенный текст протокола
    
    Returns:
        dict: JSON из ответа LLM
    """
    # 1. Извлекаем чанки
    unique_chunks = retrieve_chunks()
    
    # 2. Формируем промпт
    human_msg = build_human_prompt(protocol_text, unique_chunks)
    
    # 3. Отправляем в LLM
    messages = [
        SystemMessage(content=CLINREC_SYSTEM_PROMPT),
        human_msg
        ]

    
    response = llm_clinrec.invoke(messages)
    
    # 4. Парсим JSON ответ
    try:
        result = json.loads(response.content)
    except json.JSONDecodeError:
        result = {
            "error": "Invalid JSON response from LLM",
            "raw_response": response.content
        }
    
    return result