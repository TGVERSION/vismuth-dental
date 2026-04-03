import os
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

class Settings(BaseModel):
    gigachat_token: str = os.getenv("GIGA_TOKEN", "")
    sentence_model_path: str = os.getenv("SENTENCE_MODEL_PATH", "./ru-en-RoSBERTa")
    chromadb_path: str = os.getenv("CHROMADB_PATH", "./rosberta_chromadb")
    chromadb_collection: str = os.getenv("CHROMADB_COLLECTION", "mkb_codes")
    llm_model: str = os.getenv("LLM_MODEL", "GigaChat-2")
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "50"))

settings = Settings()