from typing import Any

from fastapi import APIRouter

from app.precios.models import ErrorResponse
from app.recomendaciones.models import RankingRequest, RankingResponse
from app.recomendaciones.service import ranking

ERRORS: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse},
    500: {"model": ErrorResponse},
}

router = APIRouter(
    prefix="/v1/recomendaciones", tags=["recomendaciones"], responses=ERRORS
)


@router.post("/ranking", response_model=RankingResponse)
def ranking_reposicion(body: RankingRequest) -> RankingResponse:
    """Rank materials for restock with an explainable weighted score."""
    return RankingResponse(items=ranking(body.items, body.referencia))
