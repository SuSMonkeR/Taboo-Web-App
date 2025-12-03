from typing import List, Optional
from pydantic import BaseModel

from .models import Deck


class LibraryStateOut(BaseModel):
    categories: List[str]
    decks: List[Deck]


class ImportFromUrlRequest(BaseModel):
    url: str
    name: Optional[str] = None
    category: str | None = None
    taboo_words_per_card: int = 4

class AddCategoryRequest(BaseModel):
    name: str


class MoveDeckRequest(BaseModel):
    category: str
