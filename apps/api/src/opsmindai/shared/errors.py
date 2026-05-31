from fastapi import Request
from fastapi.responses import JSONResponse

from opsmindai.shared.logging import logger
from opsmindai.shared.responses import error_response


class OpsMindError(Exception):
    code = "system.unexpected"
    status_code = 500

    def __init__(self, message: str, details=None):
        self.message = message
        self.details = details


class ValidationError(OpsMindError):
    code = "validation.bad_input"
    status_code = 422


class NotFoundError(OpsMindError):
    code = "resource.not_found"
    status_code = 404


class ProviderUnavailableError(OpsMindError):
    code = "llm.provider_unavailable"
    status_code = 503


async def opsmind_exception_handler(request: Request, exc: OpsMindError):
    logger.error(
        exc.message,
        extra={"event": "request.failed", "status_code": exc.status_code},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(
            code=exc.code,
            message=exc.message,
            details=exc.details,
        ),
    )
