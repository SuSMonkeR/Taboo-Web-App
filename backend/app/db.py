from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from .models import LibraryState, Deck


DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

LIBRARY_FILE = DATA_DIR / "library.json"


def _default_state() -> LibraryState:
    """Return a fresh default library state."""
    return LibraryState(categories=["Uncategorized"], decks=[])


def load_library() -> LibraryState:
    """Load the library from disk, or return an empty default state."""
    if not LIBRARY_FILE.exists():
        return _default_state()

    try:
        raw = json.loads(LIBRARY_FILE.read_text(encoding="utf-8"))
        return LibraryState.model_validate(raw)
    except Exception:
        # If file is corrupted, fall back to a clean state
        return _default_state()


def save_library(state: LibraryState) -> None:
    """Persist the current library state to disk."""
    payload = state.model_dump()
    LIBRARY_FILE.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def upsert_deck(deck: Deck) -> LibraryState:
    """Insert or replace a deck, then save and return the updated state."""
    state = load_library()
    existing_idx: Optional[int] = None
    for idx, d in enumerate(state.decks):
        if d.id == deck.id:
            existing_idx = idx
            break

    if existing_idx is None:
        state.decks.append(deck)
    else:
        state.decks[existing_idx] = deck

    save_library(state)
    return state


def delete_deck(deck_id: str) -> LibraryState:
    state = load_library()
    state.decks = [d for d in state.decks if d.id != deck_id]
    save_library(state)
    return state
