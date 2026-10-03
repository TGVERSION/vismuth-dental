"""Middleware логирования HTTP-запросов.

Даёт по одной строке на запрос и request-id, который подхватывают
все логи внутри обработки — включая логи сервисов.
"""

import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config.log_config import request_id_ctx

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"

# id приходит из заголовка от клиента: пускаем только безопасные символы,
# иначе перевод строки в логе нарисует фальшивые строки
_UNSAFE_REQUEST_ID_CHARS = re.compile(r"[^A-Za-z0-9._-]")
_REQUEST_ID_MAX_LEN = 64


def _request_id(request: Request) -> str:
    raw = request.headers.get(REQUEST_ID_HEADER, "")
    cleaned = _UNSAFE_REQUEST_ID_CHARS.sub("", raw)[:_REQUEST_ID_MAX_LEN]
    return cleaned or uuid.uuid4().hex[:12]


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = _request_id(request)
        token = request_id_ctx.set(request_id)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            # лог до reset контекста, иначе request_id потеряется
            logger.exception(
                "request failed method=%s path=%s ms=%.1f",
                request.method,
                request.url.path,
                (time.perf_counter() - started) * 1000,
            )
            raise
        else:
            logger.info(
                "request done method=%s path=%s status=%s ms=%.1f",
                request.method,
                request.url.path,
                response.status_code,
                (time.perf_counter() - started) * 1000,
            )
            response.headers[REQUEST_ID_HEADER] = request_id
            return response
        finally:
            request_id_ctx.reset(token)
