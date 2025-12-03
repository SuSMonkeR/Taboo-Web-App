from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException

from .. import db
from ..models import Deck
from ..schemas import (
    LibraryStateOut,
    ImportFromUrlRequest,
    AddCategoryRequest,
    MoveDeckRequest,
)
from ..services.taboo_parser import fetch_csv_text, parse_deck_from_csv


router = APIRouter(
    prefix="/library",
    tags=["library"],
)


@router.get("/decks-state", response_model=LibraryStateOut)
async def get_decks_state() -> LibraryStateOut:
    """
    Return all categories + decks for the Manage tab.

    Also guarantees that 'Uncategorized' always exists.
    """
    state = db.load_library()

    if "Uncategorized" not in state.categories:
        state.categories.insert(0, "Uncategorized")
        db.save_library(state)

    return LibraryStateOut(categories=state.categories, decks=state.decks)


@router.post("/decks/refresh-from-source", response_model=LibraryStateOut)
async def refresh_decks_from_source() -> LibraryStateOut:
    """
    Re-fetch all Google Sheets–backed decks from their source URLs.

    Use this when you've updated your Google Sheets and want to sync
    the stored cards in library.json.
    """
    state = db.load_library()
    dirty = False

    for deck in state.decks:
        # Only refresh Google Sheets decks that have a source URL
        if deck.source_type != "google_sheets":
            continue
        if not deck.source:
            continue

        try:
            csv_text = await fetch_csv_text(deck.source)
            # Use the deck's configured taboo_words_per_card (default is 4)
            cards = parse_deck_from_csv(csv_text, deck.taboo_words_per_card)
        except Exception as exc:
            # Don't kill the whole refresh if one deck fails
            print(f"Failed to refresh deck {deck.id}: {exc}")
            continue

        if cards:
            deck.cards = cards
            deck.card_count = len(cards)
            dirty = True

    if dirty:
        db.save_library(state)

    return LibraryStateOut(categories=state.categories, decks=state.decks)


@router.post("/decks/from-url", response_model=LibraryStateOut)
async def import_deck_from_url(body: ImportFromUrlRequest) -> LibraryStateOut:
    """
    Import a deck from a Google Sheets/CSV URL and add it to the library.

    This is where we actually parse the CSV into TabooCard objects and
    store them on the Deck.
    """
    # Pull raw data so we're safe even if the Pydantic model doesn't
    # actually define taboo_words_per_card yet.
    body_data = body.dict()
    taboo_words_per_card = body_data.get("taboo_words_per_card", 4)

    if taboo_words_per_card is None:
        taboo_words_per_card = 4

    try:
        taboo_words_per_card = int(taboo_words_per_card)
    except (TypeError, ValueError):
        taboo_words_per_card = 4

    if taboo_words_per_card < 1:
        raise HTTPException(
            status_code=400,
            detail="taboo_words_per_card must be at least 1.",
        )

    csv_text = await fetch_csv_text(body.url)
    cards = parse_deck_from_csv(csv_text, taboo_words_per_card)

    if not cards:
        raise HTTPException(
            status_code=400,
            detail="No cards found in CSV with the expected Taboo layout.",
        )

    category = body.category or "Uncategorized"

    state = db.load_library()
    if category not in state.categories:
        state.categories.append(category)

    deck_name = body.name.strip() if body.name else _make_deck_name()

    # Store the parsed `cards` list and the taboo_words_per_card setting on the Deck.
    deck = Deck(
        id=str(uuid4()),
        name=deck_name,
        category=category,
        card_count=len(cards),
        source_type="google_sheets",
        source=body.url,
        taboo_words_per_card=taboo_words_per_card,
        cards=cards,
    )

    state.decks.append(deck)
    db.save_library(state)
    return LibraryStateOut(categories=state.categories, decks=state.decks)


def _make_deck_name() -> str:
    # Generic fallback if user didn't provide a name
    return "Imported deck"


@router.post("/categories", response_model=LibraryStateOut)
async def add_category(body: AddCategoryRequest) -> LibraryStateOut:
    state = db.load_library()
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty.")

    if name not in state.categories:
        state.categories.append(name)
        db.save_library(state)

    return LibraryStateOut(categories=state.categories, decks=state.decks)


@router.delete("/categories/{name}", response_model=LibraryStateOut)
async def delete_category(name: str) -> LibraryStateOut:
    state = db.load_library()
    if name == "Uncategorized":
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the 'Uncategorized' category.",
        )

    if name not in state.categories:
        raise HTTPException(status_code=404, detail="Category not found.")

    # Move decks back to 'Uncategorized'
    for deck in state.decks:
        if deck.category == name:
          deck.category = "Uncategorized"

    state.categories = [c for c in state.categories if c != name]
    db.save_library(state)
    return LibraryStateOut(categories=state.categories, decks=state.decks)


@router.patch("/decks/{deck_id}/category", response_model=LibraryStateOut)
async def move_deck_category(deck_id: str, body: MoveDeckRequest) -> LibraryStateOut:
    state = db.load_library()
    if body.category not in state.categories:
        raise HTTPException(status_code=400, detail="Target category does not exist.")

    found = False
    for deck in state.decks:
        if deck.id == deck_id:
            deck.category = body.category
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Deck not found.")

    db.save_library(state)
    return LibraryStateOut(categories=state.categories, decks=state.decks)


@router.delete("/decks/{deck_id}", response_model=LibraryStateOut)
async def delete_deck(deck_id: str) -> LibraryStateOut:
    state = db.load_library()
    original_len = len(state.decks)
    state.decks = [d for d in state.decks if d.id != deck_id]

    if len(state.decks) == original_len:
        raise HTTPException(status_code=404, detail="Deck not found.")

    db.save_library(state)
    return LibraryStateOut(categories=state.categories, decks=state.decks)
