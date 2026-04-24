from pydantic import BaseModel
from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db


router = APIRouter(prefix="/autocomplete_dict", tags=["autocomplete_dict"])

class AutocompleteRequest(BaseModel):
    full_text: str
    limit: int = 6

class AutocompleteResponse(BaseModel):
    suggestions: List[str]


async def autocomplete_mixed(db: AsyncSession, full_text: str, limit: int = 6):
    if len(full_text) < 2:
        return []
    
    words = full_text.split()
    last_word = words[-1]
    prefix_without_last = ' '.join(words[:-1])
    
    half = limit // 2
    unigram_limit = half
    bigram_limit = limit - half
    
    word_result = await db.execute(
        func.search_by_prefix(last_word, unigram_limit)
    )
    word_suggestions = [row[0] for row in word_result.fetchall()]
    
    bigram_result = await db.execute(
        func.predict_by_prefix(last_word, bigram_limit)
    )
    bigram_suggestions = [row[0] for row in bigram_result.fetchall()]
    
    result = []
    for word in word_suggestions:
        result.append(f"{prefix_without_last} {word}".strip())
    
    for bigram in bigram_suggestions:
        result.append(f"{prefix_without_last} {bigram}".strip())
    
    return result[:limit]


@router.post("/complete_dict", response_model=AutocompleteResponse)
async def autocomplete_endpoint(
    request: AutocompleteRequest,
    db: AsyncSession = Depends(get_db)
):
    suggestions = await autocomplete_mixed(db, request.full_text, request.limit)
    return AutocompleteResponse(suggestions=suggestions)