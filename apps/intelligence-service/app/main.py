import json
import os
import time
from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from app.precios.router import router as precios_router
from app.text import normalize_description

SERVICE_NAME = "intelligence-service"


def version_desplegada() -> str:
    return os.getenv("RENDER_GIT_COMMIT", "local")


def id_entrante(valor: str | None) -> str:
    limpio = (valor or "").strip()
    if 8 <= len(limpio) <= 64 and all(c.isalnum() or c in "._-" for c in limpio):
        return limpio
    return str(uuid4())


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


class EchoRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500, alias="mensaje")


class EchoResponse(BaseModel):
    echo: str = Field(alias="eco")
    service: str = Field(alias="servicio")


class NormalizeRequest(BaseModel):
    descripcion: str = Field(min_length=1, max_length=500)


class NormalizeResponse(BaseModel):
    tokens: list[str]
    descripcion_normalizada: str
    servicio: str


def handle_invalid_request(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": "invalid_request"})


def handle_internal_error(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "internal_error"})


app = FastAPI(title=SERVICE_NAME)
app.add_exception_handler(RequestValidationError, handle_invalid_request)
app.add_exception_handler(Exception, handle_internal_error)
app.include_router(precios_router)


@app.middleware("http")
async def registrar_peticion(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    inicio = time.perf_counter()
    correlation_id = id_entrante(request.headers.get("x-request-id"))
    response = await call_next(request)
    response.headers["x-request-id"] = correlation_id
    duracion_ms = int((time.perf_counter() - inicio) * 1000)
    print(
        json.dumps(
            {
                "evento": "peticion",
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duracion_ms,
            }
        ),
        flush=True,
    )
    return response


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service=SERVICE_NAME, version=version_desplegada())


@app.post("/v1/echo", response_model=EchoResponse)
def echo(body: EchoRequest) -> EchoResponse:
    return EchoResponse(eco=body.message, servicio=SERVICE_NAME)


@app.post("/v1/materiales/normalizar", response_model=NormalizeResponse)
def normalizar(body: NormalizeRequest) -> NormalizeResponse:
    tokens, descripcion_normalizada = normalize_description(body.descripcion)
    if not tokens:
        raise RequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "descripcion"),
                    "msg": "description has no tokens",
                    "input": body.descripcion,
                }
            ]
        )
    return NormalizeResponse(
        tokens=tokens,
        descripcion_normalizada=descripcion_normalizada,
        servicio=SERVICE_NAME,
    )
