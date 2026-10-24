from typing import Literal

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    error: str


class PrepareRequest(BaseModel):
    cod_material: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=500)


class PrepareResponse(BaseModel):
    termino_busqueda: str
    cotizable: bool
    motivo: Literal["personalizado", "sin_termino"] | None
