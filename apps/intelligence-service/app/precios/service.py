import re
from datetime import datetime

from app.precios.models import (
    Candidate,
    Material,
    PrepareResponse,
    SourceContent,
    SourceResult,
)
from app.precios.parsers import PARSERS, ParseError
from app.text import fold, normalize_description

MAX_CANDIDATES = 5
BRAND_WEIGHT = 0.2
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


def stem(token: str) -> str:
    return token[:-1] if len(token) > 3 and token.endswith("s") else token


def stems(text: str) -> set[str]:
    return {stem(token) for token in normalize_description(text)[0]}


def score(term: set[str], candidate: Candidate) -> float:
    if not term:
        return 0.0
    overlap = len(term & stems(candidate.nombre)) / len(term)
    if overlap == 0:
        return 0.0
    brand = 1.0 if candidate.marca and term & stems(candidate.marca) else 0.0
    return round((1 - BRAND_WEIGHT) * overlap + BRAND_WEIGHT * brand, 3)


def process_source(
    material: Material, content: SourceContent, reference: datetime
) -> SourceResult:
    expected_type, parse = PARSERS[content.fuente]
    records: list[Candidate] = []
    invalid = 0
    parsed_pages = 0
    if content.tipo == expected_type:
        for page in content.contenido:
            try:
                page_records, page_invalid = parse(page, reference)
            except ParseError:
                invalid += 1
                continue
            parsed_pages += 1
            records += page_records
            invalid += page_invalid
    if parsed_pages == 0 or (not records and invalid):
        return SourceResult(
            fuente=content.fuente,
            estado="invalid_content",
            candidatos=[],
            descartados=invalid,
        )
    term = stems(material.termino_busqueda)
    unique: dict[str, Candidate] = {}
    for candidate in records:
        unique.setdefault(candidate.id_externo, candidate)  # first one wins
    scored = [
        candidate.model_copy(update={"puntaje": score(term, candidate)})
        for candidate in unique.values()
    ]
    related = sorted((c for c in scored if c.puntaje > 0), key=lambda c: -c.puntaje)
    top = related[:MAX_CANDIDATES]
    return SourceResult(
        fuente=content.fuente,
        estado="ok" if top else "sin_resultados",
        candidatos=top,
        descartados=invalid + len(records) - len(top),
    )
