import json
from langchain_core.messages import SystemMessage, HumanMessage
from .llm_setup import llm_fullness
from .prompts import LIFE_ANAMNES_SYSTEM_PROMPT

async def get_life_anamnes_fullness(example_prompt: str) -> dict:
    messages = [
        SystemMessage(content=LIFE_ANAMNES_SYSTEM_PROMPT),
        HumanMessage(content=example_prompt)
    ]
    
    response = await llm_fullness.ainvoke(messages)
    result = json.loads(response.content)
    
    return result