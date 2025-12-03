from __future__ import annotations

import csv
import io
from typing import List

import httpx

from ..models import TabooCard


async def fetch_csv_text(url: str) -> str:
    """Fetch raw CSV text from a URL (e.g. a published Google Sheets link)."""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text


def parse_deck_from_csv(csv_text: str, taboo_words_per_card: int) -> List[TabooCard]:
    """Parse a Taboo deck from CSV text with a configurable number of taboo words.

    Layout is column-oriented. For each column:

      - The deck is divided into vertical "groups" of rows.
      - Each group has:
          row 0 in group:   word
          rows 1..N in group: taboo words
        where N == taboo_words_per_card.

    So the group size is (1 + taboo_words_per_card). Example:

      taboo_words_per_card = 4  -> group of 5 rows:
        r+0: word
        r+1..4: taboo

      taboo_words_per_card = 1  -> group of 2 rows:
        r+0: word
        r+1: taboo

    This lets you support decks with 1, 2, 4, 7, etc., taboo words per card,
    while still sharing the same parser.
    """
    # Sanity: avoid nonsense / crashy values
    if taboo_words_per_card < 1:
        taboo_words_per_card = 1

    rows = list(csv.reader(io.StringIO(csv_text)))
    cards: List[TabooCard] = []

    if not rows:
        return cards

    max_cols = max(len(r) for r in rows)
    max_rows = len(rows)
    group_size = 1 + taboo_words_per_card  # word row + N taboo rows

    def get_cell(r_index: int, c_index: int) -> str:
        if 0 <= r_index < max_rows and 0 <= c_index < len(rows[r_index]):
            return rows[r_index][c_index].strip()
        return ""

    for col_idx in range(max_cols):
        start_row = 0
        while start_row < max_rows:
            # row 0 in the group → word
            word = get_cell(start_row + 0, col_idx)

            if not word:
                # If the *entire* group is blank, stop processing this column
                all_blank = True
                for r in range(start_row, min(start_row + group_size, max_rows)):
                    if get_cell(r, col_idx):
                        all_blank = False
                        break
                if all_blank:
                    break
                # Otherwise skip this malformed group
                start_row += group_size
                continue

            # rows 1..N → taboo words
            taboo_words: List[str] = []
            for offset in range(1, group_size):
                r_index = start_row + offset
                if r_index >= max_rows:
                    break
                val = get_cell(r_index, col_idx)
                if val:
                    taboo_words.append(val)

            cards.append(TabooCard(word=word, taboo=taboo_words))

            start_row += group_size

    return cards
