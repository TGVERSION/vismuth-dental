from langchain_gigachat.chat_models.gigachat import GigaChat
from sentence_transformers import SentenceTransformer
import chromadb
from app.config import settings

llm = GigaChat(
    model=settings.llm_model,
    temperature=settings.llm_temperature,
    max_tokens=settings.llm_max_tokens,
    credentials=settings.gigachat_token,
    verify_ssl_certs=False
)

model = SentenceTransformer(settings.sentence_model_path)
model.to('cpu')

client = chromadb.PersistentClient(path=settings.chromadb_path)
collection = client.get_collection(settings.chromadb_collection)