# backend/app/api/library.py
from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app import db
from app.models import Deck
from app.schemas import (
    LibraryStateOut,
    ImportFromUrlRequest,
    AddCategoryRequest,
    MoveDeckRequest,
    DeleteCategoryRequest,
)
from app.services.taboo_parser import fetch_csv_text, parse_deck_from_csv
from app.services.crud_deck import (
    get_all_decks,
    create_deck,
    get_deck_by_id,
    update_deck,
    update_deck_cards,
    delete_deck,
    move_deck_to_category,
)


router = APIRouter(
    prefix="/library",
    tags=["library"],
)


@router.get("/decks-state", response_model=LibraryStateOut)
async def get_decks_state() -> LibraryStateOut:
    """
    Return all categories + decks for the Manage tab.
    
    Categories from file, decks from MongoDB.
    """
    categories = db.load_categories()
    
    if "Uncategorized" not in categories:
        categories.insert(0, "Uncategorized")
        db.save_categories(categories)
    
    decks = get_all_decks()
    
    return LibraryStateOut(categories=categories, decks=decks)


@router.post("/decks/refresh-from-source", response_model=LibraryStateOut)
async def refresh_decks_from_source() -> LibraryStateOut:
    """
    Re-fetch all Google Sheets–backed decks from their source URLs.
    """
    decks = get_all_decks()
    
    for deck in decks:
        if deck.source_type != "google_sheets":
            continue
        if not deck.source:
            continue

        try:
            csv_text = await fetch_csv_text(deck.source)
            cards = parse_deck_from_csv(csv_text, deck.taboo_words_per_card)
        except Exception as exc:
            print(f"Failed to refresh deck {deck.id}: {exc}")
            continue

        if cards:
            update_deck_cards(deck.id, cards)
    
    # Return fresh state
    categories = db.load_categories()
    decks = get_all_decks()
    return LibraryStateOut(categories=categories, decks=decks)


@router.post("/decks/from-url", response_model=LibraryStateOut)
async def import_deck_from_url(body: ImportFromUrlRequest) -> LibraryStateOut:
    """
    Import a deck from a Google Sheets/CSV URL and add it to MongoDB.
    """
    taboo_words_per_card = body.taboo_words_per_card or 4

    try:
        csv_text = await fetch_csv_text(body.url)
        cards = parse_deck_from_csv(csv_text, taboo_words_per_card)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to import deck from URL: {exc}",
        )

    if not cards:
        raise HTTPException(
            status_code=400,
            detail="No valid cards found in the provided CSV/Sheets URL.",
        )

    # Either use provided name or make a generic one
    deck_name = (body.name or "").strip() or "Imported deck"

    # Category: if provided and it doesn't exist yet, add it
    category = (body.category or "").strip() or "Uncategorized"
    categories = db.load_categories()
    if category not in categories:
        categories.append(category)
        db.save_categories(categories)

    # Create deck in MongoDB
    create_deck(
        name=deck_name,
        cards=cards,
        source=body.url,
        category=category,
    )
    
    # Return fresh state
    categories = db.load_categories()
    decks = get_all_decks()
    return LibraryStateOut(categories=categories, decks=decks)


@router.post("/categories", response_model=LibraryStateOut)
async def add_category(body: AddCategoryRequest) -> LibraryStateOut:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Category name cannot be empty.")

    categories = db.add_category(name)
    decks = get_all_decks()
    
    return LibraryStateOut(categories=categories, decks=decks)


@router.delete("/categories/{category_name}", response_model=LibraryStateOut)
async def delete_category(category_name: str) -> LibraryStateOut:
    """
    Delete a category. All decks in this category will be moved to Uncategorized.
    """
    if category_name == "Uncategorized":
        raise HTTPException(status_code=400, detail="Cannot delete Uncategorized category.")
    
    # Move all decks in this category to Uncategorized
    decks = get_all_decks()
    for deck in decks:
        if deck.category == category_name:
            move_deck_to_category(deck.id, "Uncategorized")
    
    # Remove category
    categories = db.remove_category(category_name)
    
    # Return fresh state
    decks = get_all_decks()
    return LibraryStateOut(categories=categories, decks=decks)


@router.post("/decks/move", response_model=LibraryStateOut)
async def move_deck(body: MoveDeckRequest) -> LibraryStateOut:
    """
    Move a deck to a different category.
    """
    deck = get_deck_by_id(body.deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found.")
    
    categories = db.load_categories()
    if body.category not in categories:
        raise HTTPException(status_code=400, detail="Category does not exist.")
    
    move_deck_to_category(body.deck_id, body.category)
    
    # Return fresh state
    decks = get_all_decks()
    return LibraryStateOut(categories=categories, decks=decks)


@router.delete("/decks/{deck_id}", response_model=LibraryStateOut)
async def delete_deck_endpoint(deck_id: str) -> LibraryStateOut:
    """
    Delete a deck from MongoDB.
    """
    deck = get_deck_by_id(deck_id)
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found.")
    
    delete_deck(deck_id)
    
    # Return fresh state
    categories = db.load_categories()
    decks = get_all_decks()
    return LibraryStateOut(categories=categories, decks=decks)
