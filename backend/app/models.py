from typing import List, Optional
from datetime import datetime

from bson import ObjectId
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


# -------- Workbook models (moved here from models/workbook.py) --------

class WorkbookTab(BaseModel):
    tab_name: str
    sheet_gid: int
    deck_id: Optional[str] = None   # id of deck created for this tab


class Workbook(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    workbook_id: str                      # Google Sheets ID
    name: str                             # Workbook title
    tabs: List[WorkbookTab] = []          # List of sheet tabs
    last_synced: Optional[datetime] = None

    class Config:
        json_encoders = {ObjectId: str}
        allow_population_by_field_name = True
