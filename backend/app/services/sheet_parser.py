# backend/app/sheet_parser.py
import requests
from typing import List, Dict, Any, Optional
from app.config import settings


class GoogleSheetsError(Exception):
    """Custom error for Google Sheets parsing failures."""
    pass


def extract_sheet_id(spreadsheet_url: str) -> str:
    """
    Extract the Google Sheets ID from a URL or return the raw ID if already provided.
    """
    if "docs.google.com" in spreadsheet_url:
        try:
            # URLs look like: https://docs.google.com/spreadsheets/d/ID_HERE/edit
            return spreadsheet_url.split("/d/")[1].split("/")[0]
        except Exception:
            raise GoogleSheetsError("Invalid Google Sheets URL format.")
    return spreadsheet_url  # assume raw ID


def fetch_workbook_metadata(sheet_id: str) -> Dict[str, Any]:
    """
    Fetch workbook metadata (list of tabs) using the Sheets API.
    """
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}"
        f"?key={settings.GOOGLE_SHEETS_API_KEY}"
    )
    resp = requests.get(url)

    if resp.status_code != 200:
        raise GoogleSheetsError(f"Failed to fetch workbook metadata: {resp.text}")

    return resp.json()


def fetch_tab_values(sheet_id: str, tab_name: str) -> List[List[str]]:
    """
    Fetch VALUES from a single sheet tab. Returns list of rows, each row is a list of cells.
    """
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}"
        f"/values/{tab_name}?key={settings.GOOGLE_SHEETS_API_KEY}"
    )
    resp = requests.get(url)

    if resp.status_code != 200:
        raise GoogleSheetsError(
            f"Failed to fetch tab '{tab_name}' values: {resp.text}"
        )

    data = resp.json()
    return data.get("values", [])


def parse_columns_to_cards(columnar_data: List[List[str]]) -> List[Dict[str, Any]]:
    """
    Given column-major data (list of columns),
    return a list of card dicts: {goal, taboos[]}.
    """
    cards = []

    for col in columnar_data:
        if not col:
            continue

        goal = col[0].strip()
        taboos = [c.strip() for c in col[1:] if c.strip() != ""]

        if goal:
            cards.append({"goal": goal, "taboos": taboos})

    return cards


def transpose_rows_to_columns(rows: List[List[str]]) -> List[List[str]]:
    """
    Sheets API returns row-major data. We need columns.
    If one row is shorter than others, pad with empty strings.
    """
    if not rows:
        return []

    max_len = max(len(r) for r in rows)
    padded = [r + [""] * (max_len - len(r)) for r in rows]

    # Transpose
    return list(map(list, zip(*padded)))


def parse_workbook(spreadsheet_url_or_id: str) -> Dict[str, Any]:
    """
    Core function: Given a Google Sheets URL or ID,
    fetch all tabs and convert each tab into a deck structure.

    Returns:
    {
        "sheet_id": "...",
        "name": "...",
        "tabs": [
            {
                "tab_name": "Tab1",
                "sheet_gid": 123456,
                "cards": [ {goal:"", taboos:[...]}, ... ]
            },
            ...
        ]
    }
    """
    sheet_id = extract_sheet_id(spreadsheet_url_or_id)
    metadata = fetch_workbook_metadata(sheet_id)

    workbook_title = metadata.get("properties", {}).get("title", "Untitled Workbook")
    sheet_tabs = metadata.get("sheets", [])

    parsed_tabs = []

    for tab in sheet_tabs:
        props = tab.get("properties", {})
        tab_name = props.get("title")
        gid = props.get("sheetId")

        # Fetch values for this tab
        rows = fetch_tab_values(sheet_id, tab_name)

        # Convert rows → columns → cards
        columns = transpose_rows_to_columns(rows)
        cards = parse_columns_to_cards(columns)

        # Store info
        parsed_tabs.append({
            "tab_name": tab_name,
            "sheet_gid": gid,
            "cards": cards
        })

    return {
        "sheet_id": sheet_id,
        "name": workbook_title,
        "tabs": parsed_tabs
    }
