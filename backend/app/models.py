from typing import List
from pydantic import BaseModel, Field


class TabooCard(BaseModel):
    word: str
    taboo: List[str]


class Deck(BaseModel):
    id: str
    name: str
    category: str  # e.g. "Uncategorized", "Family", etc.
    card_count: int
    source_type: str  # "google_sheets" or "csv"
    source: str       # original URL or filename

    # How many taboo words each card in this deck is *intended* to have.
    # This drives the CSV parser when refreshing from source.
    taboo_words_per_card: int = 4

    # Stored cards (no image field anymore)
    cards: List[TabooCard] = Field(default_factory=list)


class LibraryState(BaseModel):
    categories: List[str]
    decks: List[Deck]
