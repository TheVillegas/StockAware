from pydantic import AwareDatetime, BaseModel, Field, model_validator


class ItemRanking(BaseModel):
    """Data NestJS gathered for one material of the selected warehouse."""

    cod_material: str = Field(min_length=1, max_length=20)
    stock: int | None = None
    stock_minimo: int | None = None
    consumo_diario: float | None = Field(
        default=None, ge=0, description="Average daily OUT over the last 365 days"
    )
    consumo_reciente: float | None = Field(
        default=None, ge=0, description="Average daily OUT over the last 30 days"
    )
    ultimo_precio: float | None = Field(
        default=None, gt=0, description="Last price paid (CLP)"
    )
    precio_externo: float | None = Field(
        default=None, gt=0, description="Best stored external price (CLP)"
    )
    precio_externo_obtenido_en: AwareDatetime | None = None


class RankingRequest(BaseModel):
    referencia: AwareDatetime = Field(description="Reference instant for freshness")
    items: list[ItemRanking] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def materials_are_unique(self) -> "RankingRequest":
        codes = [item.cod_material for item in self.items]
        if len(codes) != len(set(codes)):
            raise ValueError("duplicate cod_material")
        return self


class Razon(BaseModel):
    factor: str
    valor: float
    peso: float
    texto: str


class ItemRecomendado(BaseModel):
    cod_material: str
    puntaje: float = Field(ge=0, le=1)
    cantidad_sugerida: int = Field(ge=0)
    razones: list[Razon]
    factores_faltantes: list[str]


class RankingResponse(BaseModel):
    items: list[ItemRecomendado]
