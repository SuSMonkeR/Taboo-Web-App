from __future__ import annotations

import json
from pathlib import Path
from typing import List

DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

CATEGORIES_FILE = DATA_DIR / "categories.json"


def _default_categories() -> List[str]:
    """Return default categories list."""
    return ["Uncategorized"]


def load_categories() -> List[str]:
    """Load categories from disk, or return default."""
    if not CATEGORIES_FILE.exists():
        return _default_categories()

    try:
        raw = json.loads(CATEGORIES_FILE.read_text(encoding="utf-8"))
        if isinstance(raw, list):
            return raw
        return _default_categories()
    except Exception:
        return _default_categories()


def save_categories(categories: List[str]) -> None:
    """Persist categories to disk."""
    CATEGORIES_FILE.write_text(
        json.dumps(categories, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def add_category(category: str) -> List[str]:
    """Add a new category and return updated list."""
    categories = load_categories()
    if category not in categories:
        categories.append(category)
        save_categories(categories)
    return categories


def remove_category(category: str) -> List[str]:
    """Remove a category and return updated list."""
    categories = load_categories()
    if category in categories:
        categories.remove(category)
        save_categories(categories)
    return categories


# DEPRECATED FUNCTIONS - kept for backward compatibility during migration
# These will be removed once all code is updated

from .models import LibraryState, Deck

LIBRARY_FILE = DATA_DIR / "library.json"


def _default_state() -> LibraryState:
    """Return a fresh default library state."""
    return LibraryState(categories=["Uncategorized"], decks=[])


def load_library() -> LibraryState:
    """DEPRECATED: Load the library from disk. Use load_categories() + get_all_decks() instead."""
    if not LIBRARY_FILE.exists():
        return _default_state()

    try:
        raw = json.loads(LIBRARY_FILE.read_text(encoding="utf-8"))
        return LibraryState.model_validate(raw)
    except Exception:
        return _default_state()


def save_library(state: LibraryState) -> None:
    """DEPRECATED: Persist library state. Use save_categories() instead."""
    payload = state.model_dump()
    LIBRARY_FILE.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def upsert_deck(deck: Deck) -> LibraryState:
    """DEPRECATED: Use crud_deck functions instead."""
    from .services.crud_deck import get_deck_by_id, create_deck, update_deck
    
    existing = get_deck_by_id(deck.id)
    if existing:
        # Update existing deck
        update_dict = deck.model_dump(exclude={"id"})
        update_deck(deck.id, **update_dict)
    else:
        # This shouldn't happen in new code
        pass
    
    # Return state for backward compatibility
    return load_library()


def delete_deck(deck_id: str) -> LibraryState:
    """DEPRECATED: Use crud_deck.delete_deck() instead."""
    from .services.crud_deck import delete_deck as mongo_delete_deck
    mongo_delete_deck(deck_id)
    
    # Return state for backward compatibility
    return load_library()
