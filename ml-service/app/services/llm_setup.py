from langchain_gigachat.chat_models.gigachat import GigaChat
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.utils import embedding_functions
from app.config import settings


class QwenEmbeddingFunction(embedding_functions.EmbeddingFunction):
    def __init__(self, model):
        self.model = model
    
    def __call__(self, input):
        return self.model.encode(input).tolist()


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

llm_clinrec = GigaChat(
    model=settings.llm_model_clinrec,
    temperature=settings.llm_temperature_clinrec,
    max_tokens=settings.llm_max_tokens_clinrec,
    credentials=settings.gigachat_token,
    verify_ssl_certs=False
)

mkb_emb_model = SentenceTransformer(settings.mkb_model_path)
mkb_emb_model.to('cpu')
mkb_client = chromadb.PersistentClient(path=settings.mkb_chromadb_path)
mkb_collection = mkb_client.get_collection(settings.mkb_chromadb_collection)

clinrec_emb_model = SentenceTransformer(settings.clinrec_model_path)
clinrec_emb_model.to('cpu')
clinrec_client = chromadb.PersistentClient(path=settings.clinrec_chromadb_path)
clinrec_collection = clinrec_client.get_collection(
    settings.clinrec_chromadb_collection,
    embedding_function=QwenEmbeddingFunction(clinrec_emb_model)
)