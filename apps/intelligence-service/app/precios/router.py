from typing import Any

from fastapi import APIRouter

from app.precios.models import (
    ErrorResponse,
    PrepareRequest,
    PrepareResponse,
)
from app.precios.service import prepare

ERRORS: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse},
    500: {"model": ErrorResponse},
}

router = APIRouter(prefix="/v1/precios", tags=["precios"], responses=ERRORS)


@router.post("/preparar", response_model=PrepareResponse)
def preparar(body: PrepareRequest) -> PrepareResponse:
    """Build the search term and decide whether the material can be quoted."""
    return prepare(body.nombre)
