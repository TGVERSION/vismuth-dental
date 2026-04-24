# models.py
from sqlalchemy import Column, Integer, String, Float, Index

from ..db import Base

class Dictionary(Base):
    __tablename__ = "ml_unigrams"
    
    id = Column(Integer, primary_key=True)
    word = Column(String, nullable=False, unique=True)
    frequency = Column(Integer, default=0)
    weight = Column(Float, default=0.0)
    
    __table_args__ = (
        Index("idx_dict_word", word, postgresql_ops={"word": "text_pattern_ops"}),
        Index("idx_dict_weight", weight.desc()),
    )

class Bigram(Base):
    __tablename__ = "ml_bigrams"
    
    id = Column(Integer, primary_key=True)
    bigram = Column(String, nullable=False, unique=True)
    first_word = Column(String, nullable=False)
    second_word = Column(String, nullable=False)
    frequency = Column(Integer, default=0)
    weight = Column(Float, default=0.0)
    
    __table_args__ = (
        Index("idx_bigram_bigram", bigram, postgresql_ops={"bigram": "text_pattern_ops"}),
        Index("idx_bigram_first", first_word, postgresql_ops={"first_word": "text_pattern_ops"}),
        Index("idx_bigram_weight", weight.desc()),
    )