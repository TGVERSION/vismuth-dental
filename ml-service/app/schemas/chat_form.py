from enum import StrEnum

from pydantic import BaseModel, Field


class ChatRole(StrEnum):
    """Роль отправителя сообщения."""

    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    """Одно сообщение чата."""

    role: ChatRole = Field(description="Роль отправителя: user | assistant")
    text: str = Field(description="Текст сообщения")


class ChatMessages(BaseModel):
    """Набор сообщений чата."""

    messages: list[ChatMessage] = Field(
        description="История сообщений чата",
    )


class ChatAnswer(BaseModel):
    """Ответ чата."""

    messages: ChatMessage = Field(description="Сообщение чата")
