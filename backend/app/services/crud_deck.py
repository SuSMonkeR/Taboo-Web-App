# backend/app/services/crud_deck.py

from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId
from pymongo.collection import Collection

from app.mongo_client import get_db
from app.models import Deck, TabooCard

db = get_db()
decks_collection: Collection = db["decks"]


def _doc_to_deck(doc) -> Optional[Deck]:
    """Convert a MongoDB document to a Deck model."""
    if not doc:
        return None
    
    data = dict(doc)
    # Convert MongoDB _id to string id
    if "_id" in data:
        data["id"] = str(data["_id"])
        del data["_id"]
    
    return Deck(**data)


def create_deck(
    *,
    name: str,
    cards: List[Dict[str, Any]],
    source: str,
    workbook_id: Optional[str] = None,
    sheet_gid: Optional[int] = None,
    tab_name: Optional[str] = None,
    category: str = "Uncategorized",
) -> str:
    """
    Create a new deck in MongoDB and return its deck id.

    - `cards` is a list of {"goal": str, "taboos": [str, ...]}
    - `source` will be a URL pointing back to the specific tab
    """
    taboo_cards: List[TabooCard] = [
        TabooCard(word=card["goal"], taboo=card["taboos"])
        for card in cards
    ]

    taboo_words_per_card = 0
    if taboo_cards:
        taboo_words_per_card = max(len(c.taboo) for c in taboo_cards)

    deck_id = str(uuid4())
    
    deck = Deck(
        id=deck_id,
        name=name,
        category=category,
        card_count=len(taboo_cards),
        source_type="google_sheets",
        source=source,
        taboo_words_per_card=taboo_words_per_card or 4,
        cards=taboo_cards,
    )

    # Convert to dict for MongoDB
    deck_dict = deck.model_dump(exclude={"id"})
    deck_dict["_id"] = deck_id  # Use deck_id as MongoDB _id for easy lookup
    
    decks_collection.insert_one(deck_dict)
    return deck_id


def get_all_decks() -> List[Deck]:
    """Return all decks from MongoDB."""
    return [_doc_to_deck(doc) for doc in decks_collection.find()]


def get_deck_by_id(deck_id: str) -> Optional[Deck]:
    """Get a single deck by its ID."""
    doc = decks_collection.find_one({"_id": deck_id})
    return _doc_to_deck(doc)


def update_deck_cards(deck_id: str, cards: List[Dict[str, Any]]) -> None:
    """
    Replace the cards for an existing deck while keeping its id/category/etc.
    """
    deck = get_deck_by_id(deck_id)
    if deck is None:
        # If the deck somehow disappeared, just bail quietly for now.
        return

    taboo_cards: List[TabooCard] = [
        TabooCard(word=card["goal"], taboo=card["taboos"])
        for card in cards
    ]

    taboo_words_per_card = 4
    if taboo_cards:
        taboo_words_per_card = max(len(c.taboo) for c in taboo_cards)

    # Convert cards to dict format for MongoDB
    cards_dict = [card.model_dump() for card in taboo_cards]
    
    decks_collection.update_one(
        {"_id": deck_id},
        {
            "$set": {
                "cards": cards_dict,
                "card_count": len(taboo_cards),
                "taboo_words_per_card": taboo_words_per_card,
            }
        }
    )


def update_deck(deck_id: str, **updates) -> None:
    """
    Update deck metadata (name, category, etc.).
    
    Example:
        update_deck(deck_id, category="New Category", name="New Name")
    """
    if not updates:
        return
    
    decks_collection.update_one(
        {"_id": deck_id},
        {"$set": updates}
    )


def delete_deck(deck_id: str) -> None:
    """Delete a deck from MongoDB."""
    decks_collection.delete_one({"_id": deck_id})


def move_deck_to_category(deck_id: str, category: str) -> None:
    """Move a deck to a different category."""
    update_deck(deck_id, category=category)
