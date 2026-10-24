import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from typing import Any, Literal

from pydantic import ValidationError

from app.precios.models import Candidate, Source

SOLOTODO_MAX_AGE = timedelta(days=14)
SODIMAC_ARTICLE_URL = "https://www.sodimac.cl/sodimac-cl/articulo/"
VOID_TAGS = frozenset(
    {"img", "br", "hr", "input", "meta", "link", "source", "area", "base", "col", "wbr"}
)

Attrs = dict[str, str | None]
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


@dataclass
class Node:
    attrs: Attrs
    text: list[str] = field(default_factory=list)

    def value(self) -> str:
        return " ".join("".join(self.text).split())


@dataclass
class Entry:
    tag: str
    name: str | None
    is_card: bool
    classes: frozenset[str]


class CardParser(HTMLParser):
    """Collect product cards with the stdlib parser (no tree kept in memory)."""

    def __init__(
        self,
        is_card: Callable[[str, Attrs, frozenset[str]], bool],
        field_of: Callable[[str, Attrs, frozenset[str], set[str]], str | None],
    ) -> None:
        super().__init__()
        self.is_card = is_card
        self.field_of = field_of
        self.stack: list[Entry] = []
        self.current: dict[str, Node] | None = None
        self.cards: list[dict[str, Node]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in VOID_TAGS:
            return
        attributes = dict(attrs)
        classes = frozenset((attributes.get("class") or "").split())
        card = self.current is None and self.is_card(tag, attributes, classes)
        if card:
            self.current = {"card": Node(attributes)}
        name = None
        if self.current is not None:
            inside = set().union(*(entry.classes for entry in self.stack), classes)
            name = self.field_of(tag, attributes, classes, inside)
            if name in self.current:
                name = None  # only the first element of each field counts
            elif name:
                self.current[name] = Node(attributes)
        self.stack.append(Entry(tag, name, card, classes))

    def handle_endtag(self, tag: str) -> None:
        open_tags = [i for i, entry in enumerate(self.stack) if entry.tag == tag]
        if not open_tags:
            return
        for entry in self.stack[open_tags[-1] :]:
            if entry.is_card and self.current is not None:
                self.cards.append(self.current)
                self.current = None
        del self.stack[open_tags[-1] :]

    def handle_data(self, data: str) -> None:
        if self.current is not None:
            for entry in self.stack:
                if entry.name:
                    self.current[entry.name].text.append(data)


def collect_cards(page: str, parser: CardParser) -> list[dict[str, Node]]:
    parser.feed(page)
    parser.close()
    if not parser.cards:
        raise ParseError("no product cards found")
    return parser.cards


def rhona_field(
    tag: str, _attrs: Attrs, classes: frozenset[str], inside: set[str]
) -> str | None:
    if tag == "div" and "precio_antes" in classes:
        return "antes"
    if tag == "a":
        fields = (("titulo", "nombre"), ("valor", "precio"), ("marca", "marca"))
        return next((name for css, name in fields if css in inside), None)
    return None


def rhona_record(card: dict[str, Node]) -> dict[str, Any] | None:
    name, price, before = card.get("nombre"), card.get("precio"), card.get("antes")
    url = (name.attrs.get("href") if name else None) or ""
    product_id = re.search(r"/producto/(\d+)/", url)
    shown = clp_from_text(price.value()) if price else None
    if not (name and product_id and shown):
        return None
    old = clp_from_text(before.value()) if before else None
    return {
        "id_externo": product_id.group(1),
        "nombre": name.value(),
        "marca": card["marca"].value() if "marca" in card else None,
        "categoria_fuente": None,
        "precio_normal": old or shown,
        "precio_oferta": shown if old else None,
        "disponible": True,  # listings show price and an add-to-cart button
        "url": url,
    }


def parse_rhona(page: str, _reference: datetime) -> ParseResult:
    parser = CardParser(
        lambda tag, _a, classes: tag == "div" and "blockProducto" in classes,
        rhona_field,
    )
    return collect([rhona_record(card) for card in collect_cards(page, parser)])


def sodimac_field(
    tag: str, attrs: Attrs, classes: frozenset[str], _inside: set[str]
) -> str | None:
    if tag == "b" and "pod-title" in classes:
        return "marca"
    if tag == "b" and "pod-subTitle" in classes:
        return "nombre"
    return "precio" if tag == "li" and "data-internet-price" in attrs else None


def sodimac_record(card: dict[str, Node]) -> dict[str, Any] | None:
    key = card["card"].attrs.get("data-key")
    name, price = card.get("nombre"), card.get("precio")
    shown = clp_from_text(price.attrs["data-internet-price"] or "") if price else None
    if not (key and name and shown):
        return None
    return {
        "id_externo": key,
        "nombre": name.value(),
        "marca": card["marca"].value() if "marca" in card else None,
        "categoria_fuente": None,
        "precio_normal": shown,
        "precio_oferta": None,
        "disponible": True,  # the listing offers the item for sale
        "url": SODIMAC_ARTICLE_URL + key,
    }


def parse_sodimac(page: str, _reference: datetime) -> ParseResult:
    parser = CardParser(
        lambda tag, attrs, _c: tag == "a" and attrs.get("data-pod") == "catalyst-pod",
        sodimac_field,
    )
    return collect([sodimac_record(card) for card in collect_cards(page, parser)])


PARSERS: dict[Source, tuple[Literal["json", "html"], Parser]] = {
    "dartel": ("json", parse_vtex),
    "dimeiggs": ("json", parse_vtex),
    "solotodo": ("json", parse_solotodo),
    "rhona": ("html", parse_rhona),
    "sodimac": ("html", parse_sodimac),
}
