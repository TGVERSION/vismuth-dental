import json
from langchain_core.messages import SystemMessage, HumanMessage
from app.llm_services.llm_setup import llm_fullness
from .prompts import COMPLAINTS_SYSTEM_PROMPT

async def get_complaints_fullness(example_prompt: str) -> dict:
    messages = [
        SystemMessage(content=COMPLAINTS_SYSTEM_PROMPT),
        HumanMessage(content=example_prompt)
    ]
    
    response = await llm_fullness.ainvoke(messages)
    result = json.loads(response.content)
    
    return result