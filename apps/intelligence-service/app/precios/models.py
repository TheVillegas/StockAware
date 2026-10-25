from typing import Literal

from pydantic import AwareDatetime, BaseModel, Field, model_validator

Source = Literal["dartel", "dimeiggs", "solotodo", "rhona", "sodimac"]
SourceStatus = Literal["ok", "sin_resultados", "invalid_content"]


class ErrorResponse(BaseModel):
    error: str


class PrepareRequest(BaseModel):
    cod_material: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=500)


class PrepareResponse(BaseModel):
    termino_busqueda: str
    cotizable: bool
    motivo: Literal["personalizado", "sin_termino"] | None


class Material(BaseModel):
    cod_material: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=500)
    termino_busqueda: str = Field(min_length=1, max_length=500)


class SourceContent(BaseModel):
    """Raw content NestJS fetched for one source (up to 3 pages for Sodimac)."""

    fuente: Source
    tipo: Literal["json", "html"]
    contenido: list[str] = Field(min_length=1, max_length=3)


class ProcessRequest(BaseModel):
    material: Material
    referencia: AwareDatetime = Field(description="Reference instant for freshness")
    fuentes: list[SourceContent] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def sources_are_unique(self) -> "ProcessRequest":
        names = [item.fuente for item in self.fuentes]
        if len(names) != len(set(names)):
            raise ValueError("duplicate source")
        return self


class Candidate(BaseModel):
    id_externo: str = Field(min_length=1)
    nombre: str = Field(min_length=1)
    marca: str | None
    ean: str | None
    categoria_fuente: str | None
    precio_normal: int = Field(gt=0, description="Integer CLP")
    precio_oferta: int | None = Field(description="Integer CLP, below precio_normal")
    disponible: bool
    url: str = Field(min_length=1)
    puntaje: float = Field(default=0.0, ge=0, le=1)


class SourceResult(BaseModel):
    fuente: Source
    estado: SourceStatus
    candidatos: list[Candidate] = Field(max_length=5)
    descartados: int = Field(
        description="Records not returned (invalid, duplicate, unrelated, past top 5)"
    )


class ProcessResponse(BaseModel):
    resultados: list[SourceResult]
    servicio: str
