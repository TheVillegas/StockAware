from typing import Any

from fastapi import APIRouter

from app.precios.models import (
    ErrorResponse,
    PrepareRequest,
    PrepareResponse,
    ProcessRequest,
    ProcessResponse,
)
from app.precios.service import prepare, process_source

SERVICE_NAME = "intelligence-service"
ERRORS: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse},
    500: {"model": ErrorResponse},
}

router = APIRouter(prefix="/v1/precios", tags=["precios"], responses=ERRORS)


@router.post("/preparar", response_model=PrepareResponse)
def preparar(body: PrepareRequest) -> PrepareResponse:
    """Build the search term and decide whether the material can be quoted."""
    return prepare(body.nombre)


@router.post("/procesar", response_model=ProcessResponse)
def procesar(body: ProcessRequest) -> ProcessResponse:
    """Parse raw source content and propose up to 5 candidates per source."""
    results = [
        process_source(body.material, content, body.referencia)
        for content in body.fuentes
    ]
    return ProcessResponse(resultados=results, servicio=SERVICE_NAME)
