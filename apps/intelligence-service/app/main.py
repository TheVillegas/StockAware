from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

SERVICE_NAME = "intelligence-service"


class HealthResponse(BaseModel):
    status: str
    service: str


class EchoRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500, alias="mensaje")


class EchoResponse(BaseModel):
    echo: str = Field(alias="eco")
    service: str = Field(alias="servicio")


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
