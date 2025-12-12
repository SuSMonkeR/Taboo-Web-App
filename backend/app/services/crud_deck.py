# backend/app/services/crud_deck.py

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from app import db
from app.models import Deck, TabooCard


def _find_deck(state, deck_id: str) -> Optional[Deck]:
    for d in state.decks:
        if d.id == deck_id:
            return d
    return None


def create_deck(
    *,
    name: str,
    cards: List[Dict[str, Any]],
    source: str,
    workbook_id: str,
    sheet_gid: int,
    tab_name: str,
) -> str:
    """
    Create a new deck from a Google Sheets tab and return its deck id.

    - `cards` is a list of {"goal": str, "taboos": [str, ...]}
    - `source` will be a URL pointing back to the specific tab
    """
    state = db.load_library()

    taboo_cards: List[TabooCard] = [
        TabooCard(word=card["goal"], taboo=card["taboos"])
        for card in cards
    ]

    taboo_words_per_card = 0
    if taboo_cards:
        taboo_words_per_card = max(len(c.taboo) for c in taboo_cards)

    deck = Deck(
        id=str(uuid4()),
        name=name,
        # You can move this later from the UI; default to Uncategorized
        category="Uncategorized",
        card_count=len(taboo_cards),
        source_type="google_sheets",
        # This is what your "Sheet" button in the UI will link to:
        source=source,
        taboo_words_per_card=taboo_words_per_card or 4,
        cards=taboo_cards,
    )

    state.decks.append(deck)
    db.save_library(state)
    return deck.id


def update_deck_cards(deck_id: str, cards: List[Dict[str, Any]]) -> None:
    """
    Replace the cards for an existing deck while keeping its id/category/etc.
    """
    state = db.load_library()
    deck = _find_deck(state, deck_id)
    if deck is None:
        # If the deck somehow disappeared, just bail quietly for now.
        # (We could raise, but that would make reload brittle.)
        return

    taboo_cards: List[TabooCard] = [
        TabooCard(word=card["goal"], taboo=card["taboos"])
        for card in cards
    ]

    deck.cards = taboo_cards
    deck.card_count = len(taboo_cards)
    if taboo_cards:
        deck.taboo_words_per_card = max(len(c.taboo) for c in taboo_cards)

    db.save_library(state)
