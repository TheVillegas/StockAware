import re

from app.precios.models import PrepareResponse
from app.text import fold, normalize_description

LOGO = re.compile(r"\blogo\b")
SIZE = re.compile(r"\b(talla\s*\w+|t-?\d{2}|xs|s|m|l|xl|xxl|xxxl)\b")


def prepare(nombre: str) -> PrepareResponse:
    folded = fold(nombre)
    _, term = normalize_description(SIZE.sub(" ", folded))
    if LOGO.search(folded):
        return PrepareResponse(
            termino_busqueda=term, cotizable=False, motivo="personalizado"
        )
    if not term:
        return PrepareResponse(
            termino_busqueda="", cotizable=False, motivo="sin_termino"
        )
    return PrepareResponse(termino_busqueda=term, cotizable=True, motivo=None)
