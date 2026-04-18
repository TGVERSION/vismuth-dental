from langchain_gigachat.chat_models.gigachat import GigaChat
from sentence_transformers import SentenceTransformer
import chromadb
from app.config import settings

llm_mkb = GigaChat(
    model=settings.llm_model_mkb,
    temperature=settings.llm_temperature_mkb,
    max_tokens=settings.llm_max_tokens_mkb,
    credentials=settings.gigachat_token,
    verify_ssl_certs=False
)

llm_fullness = GigaChat(
    model=settings.llm_model_fullness,
    temperature=settings.llm_temperature_fullness,
    max_tokens=settings.llm_max_tokens_fullness,
    credentials=settings.gigachat_token,
    verify_ssl_certs=False
)

emb_model = SentenceTransformer(settings.sentence_model_path)
emb_model.to('cpu')

client = chromadb.PersistentClient(path=settings.chromadb_path)
collection = client.get_collection(settings.chromadb_collection)