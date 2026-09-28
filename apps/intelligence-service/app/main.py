import re
import unicodedata

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

SERVICE_NAME = "intelligence-service"
STOPWORDS = frozenset(
    {"de", "la", "el", "los", "las", "y", "o", "para", "con", "del", "al", "un", "una"}
)


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


def normalize_description(descripcion: str) -> tuple[list[str], str]:
    decomposed = unicodedata.normalize("NFKD", descripcion)
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    spaced = re.sub(r"[^0-9a-z]+", " ", without_marks.lower())
    seen: set[str] = set()
    tokens: list[str] = []
    for token in spaced.split():
        if len(token) < 2 or token in STOPWORDS or token in seen:
            continue
        seen.add(token)
        tokens.append(token)
    return tokens, " ".join(tokens)


def handle_invalid_request(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=422, content={"error": "invalid_request"})


def handle_internal_error(_request: Request, _exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "internal_error"})


app = FastAPI(title=SERVICE_NAME)
app.add_exception_handler(RequestValidationError, handle_invalid_request)
app.add_exception_handler(Exception, handle_internal_error)


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
