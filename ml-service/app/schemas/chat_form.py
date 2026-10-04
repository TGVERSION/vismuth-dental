from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class ChatRole(StrEnum):
    """Роль отправителя сообщения."""

    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    """Одно сообщение чата."""

    role: ChatRole = Field(description="Роль отправителя: user | assistant")
    text: str = Field(description="Текст сообщения")


class AssistantMessage(ChatMessage):
    """Сообщение ассистента: роль зафиксирована, ошибиться нельзя."""

    role: Literal[ChatRole.ASSISTANT] = ChatRole.ASSISTANT


class ChatMessages(BaseModel):
    """Набор сообщений чата."""

    messages: list[ChatMessage] = Field(
        description="История сообщений чата",
    )
