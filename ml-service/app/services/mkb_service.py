from langchain_core.messages import SystemMessage, HumanMessage
from .llm_setup import llm_mkb, emb_model, collection


def extract_diagnosis(description: str) -> str:
    """
    Извлечение главного диагноза через LLM
    
    Returns:
        tuple: (diagnosis, prompt_tokens, completion_tokens, total_tokens)
    """
    
    system_prompt = """Ты - медицинский эксперт. 
Твоя задача - проанализировать текст с описанием диагноза и выделить один, самый главный системный диагноз.

ПРАВИЛА:
1. Диагноз в начале описания, как правило, является главным.
2. Игнорируй перечисление второстепенных симптомов и сопутствующих заболеваний (родинки, кисты, невусы и т.д.).
3. Сформулируй диагноз кратко, медицинским термином или короткой фразой (максимум 5-7 слов).
4. Выведи ТОЛЬКО диагноз текстом. Без кодов, без пояснений, без нумерации.
5. Гипертоническая болезнь или гипертензия сводятся к Гипертензивная болезнь с преимущественным поражением сердца без сердечной недостаточности
6. Простудные заболевания и ОРВИ сводятся к Острая инфекция верхних дыхательных путей

ПРИМЕРЫ:

Описание: "НАЖБП, стеатоз печени. Латетный дефицит железа. Медикаментозный ринит. Ожирение (ИМТ 35/3)"
Извлеченный диагноз: Ожирение с метаболическими нарушениями

Описание: "Гипертоническая болезнь II стадии, целевое АД достигнуто, риск ССО 3"
Извлеченный диагноз: Гипертензивная болезнь с преимущественным поражением сердца без сердечной недостаточности

Описание: "ОРВИ. Острый ринофарингиотрахеит, течение"
Извлеченный диагноз: Острая инфекция верхних дыхательных путей

Описание: "Острый синусит неуточненный. Острый левосторонний фронтит?"
Извлеченный диагноз: Острый синусит неуточненный

Описание: "Острая инфекция верхних дыхательных путей с явлениями ринофарингита, тяжелое течение. Острый бронхит."
Извлеченный диагноз: Острая инфекция верхних дыхательных путей неуточненная

Описание: "Обследование и наблюдение по другим уточненным поводам. Гиперхолестеринемия. Хронический паренхиматозный панкреатит, ремиссия?"
Извлеченный диагноз: Обследование и наблюдение по другим уточненным поводам

Теперь выполни задание для нового описания. Выведи ТОЛЬКО ДИАГНОЗ ТЕКСТОМ."""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Описание: {description}")
    ]
    
    response = llm_mkb.invoke(messages)
    
    return response.content.strip()


def search_mkb(query: str, n_results: int = 3, use_prefix: bool = True) -> list:
    """
    Поиск кодов МКБ по тексту диагноза
    
    Args:
        query: текст диагноза (например, "ожирение с метаболическими нарушениями")
        n_results: количество результатов
        use_prefix: добавлять ли префикс search_query:
    
    Returns:
        список словарей с ключами: code, name, distance
    """
    # Добавляем префикс для поиска
    search_query = f"search_query: {query}" if use_prefix else query
    
    # Векторизуем
    query_emb = emb_model.encode([search_query], normalize_embeddings=True)
    
    # Ищем
    results = collection.query(
        query_embeddings=query_emb.tolist(),
        n_results=n_results,
        include=["documents", "distances", "metadatas"]
    )
    
    # Форматируем ответ
    output = []
    for doc, distance, metadata in zip(
        results['documents'][0],
        results['distances'][0],
        results['metadatas'][0]
    ):
        # Удаляем префикс search_document: из названия
        clean_name = doc
        if clean_name.startswith("search_document: "):
            clean_name = clean_name.replace("search_document: ", "")
        
        output.append({
            'code': metadata.get('mkb_code', 'N/A'),
            'name': clean_name,
            'distance': distance,
            'similarity': 1 - distance
        })
    
    return output


def get_mkb_code(description: str, 
                 n_candidates: int = 5,
                 use_llm: bool = True) -> dict:
    """
    Получение кода МКБ по описанию диагноза
    
    Returns:
        dict с ключами: 
            - extracted_diagnosis: что извлекла LLM
            - candidates: список кандидатов
            - best_code: лучший код
    """
    result = {
        'extracted_diagnosis': None,
        'candidates': [],
        'best_code': None,
        'best_name': None,
    }
    
    if use_llm:
        extracted = extract_diagnosis(description)
        result['extracted_diagnosis'] = extracted
    else:
        result['extracted_diagnosis'] = description
    
    if result['extracted_diagnosis']:
        candidates = search_mkb(result['extracted_diagnosis'], n_results=n_candidates)
        result['candidates'] = candidates
        if candidates:
            result['best_code'] = candidates[0]['code']
            result['best_name'] = candidates[0]['name']
    
    return result