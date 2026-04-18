import os
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

class Settings(BaseModel):
    gigachat_token: str = os.getenv("GIGA_TOKEN", "")
    sentence_model_path: str = os.getenv("SENTENCE_MODEL_PATH", "./ru-en-RoSBERTa")
    chromadb_path: str = os.getenv("CHROMADB_PATH", "./rosberta_chromadb")
    chromadb_collection: str = os.getenv("CHROMADB_COLLECTION", "mkb_codes")

    llm_model_mkb: str = os.getenv("LLM_MODEL", "GigaChat-2")
    llm_temperature_mkb: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    llm_max_tokens_mkb: int = int(os.getenv("LLM_MAX_TOKENS", "50"))

    llm_model_fullness: str = os.getenv("LLM_MODEL", "GigaChat-2-Pro")
    llm_temperature_fullness: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    llm_max_tokens_fullness: int = int(os.getenv("LLM_MAX_TOKENS", "200"))


settings = Settings()