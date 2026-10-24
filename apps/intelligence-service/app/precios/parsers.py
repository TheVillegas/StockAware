import json
import re
from collections.abc import Callable
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Literal

from pydantic import ValidationError

from app.precios.models import Candidate, Source

SOLOTODO_MAX_AGE = timedelta(days=14)

# Valid candidates (score still 0) and the count of invalid records.
ParseResult = tuple[list[Candidate], int]
Parser = Callable[[str, datetime], ParseResult]


class ParseError(Exception):
    """The page does not have the structure expected for its source."""


def clean_ean(value: object) -> str | None:
    text = str(value or "").strip()
    return text if re.fullmatch(r"\d{8}|\d{13}", text, re.ASCII) else None


def to_clp(value: object) -> int | None:
    """Convert a numeric value such as 3090.0 or '109990.00' to integer CLP."""
    try:
        return round(Decimal(str(value)))
    except (InvalidOperation, ValueError):
        return None


def clp_from_text(text: str) -> int | None:
    """Convert displayed price text such as '$ 20.445' (dot = thousands)."""
    digits = re.sub(r"\D", "", text)
    return int(digits) if digits else None


def build(raw: dict[str, Any]) -> Candidate | None:
    offer = raw.get("precio_oferta")
    if offer is not None and offer >= (raw["precio_normal"] or 0):
        offer = None  # not a real discount
    try:
        return Candidate(
            **{**raw, "precio_oferta": offer, "ean": clean_ean(raw.get("ean"))}
        )
    except (ValidationError, TypeError):
        return None


def load_json(page: str) -> Any:
    try:
        return json.loads(page)
    except ValueError as exc:
        raise ParseError("invalid json") from exc


def collect(raws: list[dict[str, Any] | None]) -> ParseResult:
    records = [candidate for raw in raws if raw and (candidate := build(raw))]
    return records, len(raws) - len(records)


def vtex_record(product: dict[str, Any]) -> dict[str, Any] | None:
    try:
        item = product["items"][0]
        offer = item["sellers"][0]["commertialOffer"]
        price = to_clp(offer["Price"]) or 0
        category = next(iter(product.get("categories") or []), "")
        return {
            "id_externo": str(product["productId"]),
            "nombre": str(product["productName"]).strip(),
            "marca": product.get("brand") or None,
            "ean": item.get("ean"),
            "categoria_fuente": " > ".join(p for p in category.split("/") if p) or None,
            "precio_normal": max(to_clp(offer.get("ListPrice")) or 0, price),
            "precio_oferta": price,
            "disponible": bool(offer["IsAvailable"]),
            "url": str(product["link"]),
        }
    except (KeyError, IndexError, TypeError, AttributeError):
        return None


def parse_vtex(page: str, _reference: datetime) -> ParseResult:
    products = load_json(page)
    if not isinstance(products, list):
        raise ParseError("vtex catalog must be a list")
    return collect([vtex_record(p) for p in products])


def solotodo_record(entity: dict[str, Any]) -> dict[str, Any]:
    registry = entity["active_registry"]
    return {
        "id_externo": str(entity["id"]),
        "nombre": str(entity["name"]).strip(),
        "marca": None,
        "ean": entity.get("ean"),
        "categoria_fuente": None,
        "precio_normal": to_clp(registry["normal_price"]),
        "precio_oferta": to_clp(registry["offer_price"]),
        "disponible": bool(registry["is_available"]),
        "url": str(entity["external_url"]),
    }


def is_fresh(entity: dict[str, Any], reference: datetime) -> bool:
    stamp = entity.get("last_pricing_update") or entity["active_registry"]["timestamp"]
    return reference - datetime.fromisoformat(stamp) <= SOLOTODO_MAX_AGE


def parse_solotodo(page: str, reference: datetime) -> ParseResult:
    data = load_json(page)
    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        raise ParseError("solotodo payload needs a results list")
    raws: list[dict[str, Any] | None] = []
    for entity in data["results"]:
        try:
            if not entity.get("active_registry"):
                continue  # inactive entry: filtered out, not an invalid record
            if is_fresh(entity, reference):
                raws.append(solotodo_record(entity))
        except (KeyError, TypeError, ValueError, AttributeError):
            raws.append(None)
    return collect(raws)


PARSERS: dict[Source, tuple[Literal["json"], Parser]] = {
    "dartel": ("json", parse_vtex),
    "dimeiggs": ("json", parse_vtex),
    "solotodo": ("json", parse_solotodo),
}
