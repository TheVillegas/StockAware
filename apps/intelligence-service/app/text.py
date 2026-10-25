import re
import unicodedata

STOPWORDS = frozenset(
    {"de", "la", "el", "los", "las", "y", "o", "para", "con", "del", "al", "un", "una"}
)


def fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch)).lower()


def normalize_description(descripcion: str) -> tuple[list[str], str]:
    spaced = re.sub(r"[^0-9a-z]+", " ", fold(descripcion))
    seen: set[str] = set()
    tokens: list[str] = []
    for token in spaced.split():
        if len(token) < 2 or token in STOPWORDS or token in seen:
            continue
        seen.add(token)
        tokens.append(token)
    return tokens, " ".join(tokens)
