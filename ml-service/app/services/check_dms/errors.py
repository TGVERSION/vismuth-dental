"""Ошибки проверки назначений ДМС.

Каждая ошибка несёт HTTP-код и машинный код для `detail.code`,
чтобы роутер не изобретал соответствия заново.
"""


class DmsError(Exception):
    """Ошибка пайплайна проверки с готовым HTTP-статусом."""

    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
