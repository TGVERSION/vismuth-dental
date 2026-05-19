from pydantic import BaseModel, Field
from typing import Optional, List, Dict


class SeverityCounts(BaseModel):
    critical: int = Field(default=0, ge=0, description="Критические нарушения")
    warning: int = Field(default=0, ge=0, description="Предупреждения")
    info: int = Field(default=0, ge=0, description="Информационные замечания")


class Finding(BaseModel):
    """Найденное несоответствие протокола клиническим рекомендациям"""
    severity: str = Field(description="critical|warning|info", pattern="^(critical|warning|info)$")
    section: str = Field(max_length=100, description="Название раздела протокола")
    issue: str = Field(max_length=300, description="Описание проблемы")
    recommendation: str = Field(max_length=300, description="Как исправить")
    guideline_ref: str = Field(max_length=100, description="Заголовок раздела клинрека")
    guideline_quote: str = Field(max_length=200, description="Дословная цитата из клинрека")


class ClinicalAnalysis(BaseModel):
    """Результат анализа протокола на соответствие клиническим рекомендациям"""
    severity_counts: SeverityCounts = Field(description="Количество замечаний по уровням")
    findings: List[Finding] = Field(max_length=10, description="Список замечаний")
    compliant_sections: List[str] = Field(description="Поля протокола, которые соответствуют клинрекам")


class ClinrecRequest(BaseModel):
    protocol_text: str


class ClinrecResponse(BaseModel):
    severity_counts: SeverityCounts
    findings: List[Finding]
    compliant_sections: List[str]
    error: Optional[str] = None