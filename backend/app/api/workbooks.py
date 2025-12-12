# backend/app/api/workbooks.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app import db
from app.services.sheet_parser import parse_workbook
from app.services.crud_workbook import (
    create_workbook,
    get_all_workbooks,
    update_workbook,
    get_workbook_by_id,
    update_last_synced,
    delete_workbook,
)
from app.models import Workbook, WorkbookTab
from app.services.crud_deck import create_deck, update_deck_cards


router = APIRouter(prefix="/admin/workbooks", tags=["workbooks"])


class WorkbookCreateRequest(BaseModel):
    sheet_url: str


@router.post("/add")
def add_workbook(body: WorkbookCreateRequest):
  parsed = parse_workbook(body.sheet_url)

  # Build workbook object WITHOUT deck IDs yet
  workbook = Workbook(
      workbook_id=parsed["sheet_id"],
      name=parsed["name"],
      tabs=[
          WorkbookTab(
              tab_name=t["tab_name"],
              sheet_gid=t["sheet_gid"],
              deck_id=None,
          )
          for t in parsed["tabs"]
      ],
  )

  # Insert and get Mongo ObjectId
  workbook_id = create_workbook(workbook)

  # Now create decks for each tab and wire deck IDs back into the workbook
  for tab_data in parsed["tabs"]:
      tab_url = (
          f"https://docs.google.com/spreadsheets/d/{parsed['sheet_id']}/edit"
          f"#gid={tab_data['sheet_gid']}"
      )

      deck_id = create_deck(
          name=tab_data["tab_name"],
          cards=tab_data["cards"],
          source=tab_url,  # Used by UI "Sheet" button
          workbook_id=workbook_id,
          sheet_gid=tab_data["sheet_gid"],
          tab_name=tab_data["tab_name"],
      )

      # Attach deck_id to matching workbook tab
      for t in workbook.tabs:
          if t.tab_name == tab_data["tab_name"] and t.sheet_gid == tab_data["sheet_gid"]:
              t.deck_id = deck_id
              break

  # Save workbook with deck IDs included
  update_workbook(workbook_id, workbook)
  update_last_synced(workbook_id)

  return {
      "message": "Workbook imported.",
      "workbook_id": workbook_id,
  }


@router.get("/list")
def list_workbooks():
    return [w.dict(by_alias=True) for w in get_all_workbooks()]


@router.post("/{workbook_id}/reload")
def reload_workbook(workbook_id: str):
    workbook = get_workbook_by_id(workbook_id)
    if not workbook:
        raise HTTPException(404, "Workbook not found.")

    parsed = parse_workbook(workbook.workbook_id)

    # Update decks: keep deck IDs the same, just replace cards
    for tab_data in parsed["tabs"]:
        # Find the corresponding tab by name
        tab = next(
            (t for t in workbook.tabs if t.tab_name == tab_data["tab_name"]),
            None,
        )
        if not tab or not tab.deck_id:
            continue

        update_deck_cards(tab.deck_id, tab_data["cards"])

    update_last_synced(workbook_id)
    return {"message": "Workbook reloaded."}


@router.delete("/{workbook_id}")
def remove_workbook(workbook_id: str):
    """
    Delete a workbook record from Mongo and any decks that were created from it.

    This ONLY affects:
      - Mongo 'workbooks' collection
      - Local library.json decks via db.delete_deck

    It does NOT and CANNOT modify or delete the actual Google Sheet.
    """
    workbook = get_workbook_by_id(workbook_id)
    if not workbook:
        raise HTTPException(status_code=404, detail="Workbook not found.")

    # Delete any linked decks from the local library
    for tab in workbook.tabs or []:
        if tab.deck_id:
            db.delete_deck(tab.deck_id)

    # Delete workbook document from Mongo
    delete_workbook(workbook_id)

    return {"message": "Workbook and associated decks deleted."}
