from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, GPT2LMHeadModel
import re
from typing import List, Optional

router = APIRouter(prefix="/autocomplete", tags=["autocomplete"])


class CompletionRequest(BaseModel):
    field: str
    prefix: str
    num_sequences: int = 5


class CompletionResponse(BaseModel):
    suggestions: List[str]


device = torch.device('cpu')
tokenizer = AutoTokenizer.from_pretrained("/app/autocomplete_model")
model = GPT2LMHeadModel.from_pretrained("/app/autocomplete_model").to(device)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

def clean_completion(text: str) -> str:
    if not text:
        return text

    # Убираем все подчеркивания и пробелы в начале
    text = re.sub(r'^[_]+', '', text)
    
    # Убираем пунктуационные хвосты (точки, тире, запятые, пробелы в конце)
    text = re.sub(r'[.,\-_\s]+$', '', text)
    
    # Убираем паттерны вида "3-х", "5-ти" в конце (цифра-дефис-1-2 буквы)
    text = re.sub(r'\d+[-–—][а-я]{1,2}$', '', text)
    
    # Если строка заканчивается на короткое слово (1-2 буквы)
    text = re.sub(r',\s*[а-я]{1,2}$', '', text)
    text = re.sub(r'\s+[а-я]{1,2}$', '', text)
    
    # Финальная уборка одиночных знаков
    if len(text) > 0 and text[-1] in '.-–—,':
        text = text[:-1]
    
    return text.strip()


def get_completions(field: str, prefix: str, num_sequences: int = 5) -> list:
    if len(prefix.strip()) < 2:
        return []
    
    full_prefix = f"{field}: {prefix}"
    inputs = tokenizer.encode(full_prefix, return_tensors="pt").to(device)
    
    with torch.no_grad():
        # Beam search
        outputs = model.generate(
            inputs,
            max_new_tokens=3,
            num_beams=num_sequences,
            num_return_sequences=num_sequences,
            do_sample=False,
            no_repeat_ngram_size=2,
            repetition_penalty=1.5,
            pad_token_id=tokenizer.eos_token_id
        )
    
    seen = set()
    suggestions = []
    
    for out in outputs:
        full_text = tokenizer.decode(out, skip_special_tokens=True)
        continuation = full_text[len(full_prefix):]
        cleaned = clean_completion(continuation)
        
        norm = cleaned.lower().strip()
        if not norm or len(cleaned) <= 2 or norm in seen:
            continue
            
        seen.add(norm)
        suggestions.append(cleaned)
        
        if len(suggestions) >= num_sequences:
            break
    
    return suggestions


@router.post("/complete", response_model=CompletionResponse)
async def complete(request: CompletionRequest):
    try:
        suggestions = get_completions(request.field, request.prefix, request.num_sequences)
        full_suggestions = [f"{request.prefix}{s}" for s in suggestions]
        return CompletionResponse(suggestions=full_suggestions)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
