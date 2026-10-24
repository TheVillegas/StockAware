from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.precios.router import router as precios_router
from app.text import normalize_description

SERVICE_NAME = "intelligence-service"


class HealthResponse(BaseModel):
    status: str
    service: str


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


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service=SERVICE_NAME)


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
