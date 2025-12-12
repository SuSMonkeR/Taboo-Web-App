# backend/app/services/crud_workbook.py

from datetime import datetime
from typing import Optional, List

from bson import ObjectId
from pymongo.collection import Collection

from app.mongo_client import get_db
from app.models import Workbook

db = get_db()
workbooks: Collection = db["workbooks"]


def _doc_to_workbook(doc) -> Workbook:
    """
    Internal helper: convert a raw Mongo document into a Workbook model.
    Ensures _id is a string, not an ObjectId, so Pydantic doesn't choke.
    """
    if not doc:
        return None

    data = dict(doc)
    if "_id" in data and isinstance(data["_id"], ObjectId):
        data["_id"] = str(data["_id"])
    return Workbook(**data)


def create_workbook(workbook: Workbook) -> str:
    """
    Insert a new workbook document and return its Mongo _id as a string.
    """
    # by_alias=True so "_id" is used if present; exclude_none to avoid null junk
    payload = workbook.model_dump(by_alias=True, exclude_none=True)
    result = workbooks.insert_one(payload)
    return str(result.inserted_id)


def get_all_workbooks() -> List[Workbook]:
    """
    Return all workbooks as Workbook models.
    """
    return [_doc_to_workbook(w) for w in workbooks.find()]


def get_workbook_by_id(workbook_id: str) -> Optional[Workbook]:
    """
    Look up a workbook by its Mongo _id (string) and return a Workbook model.
    """
    try:
        oid = ObjectId(workbook_id)
    except Exception:
        return None

    doc = workbooks.find_one({"_id": oid})
    if not doc:
        return None
    return _doc_to_workbook(doc)


def update_workbook(workbook_id: str, workbook: Workbook) -> None:
    """
    Update workbook metadata (name, tabs, etc.) for a given workbook_id.
    """
    try:
        oid = ObjectId(workbook_id)
    except Exception:
        return

    # Don't overwrite _id; it's immutable in Mongo.
    payload = workbook.model_dump(
        by_alias=True,
        exclude={"id"},  # don't replace the _id field
        exclude_none=True,
    )
    workbooks.update_one({"_id": oid}, {"$set": payload})


def update_last_synced(workbook_id: str) -> None:
    """
    Set last_synced to now for the given workbook.
    """
    try:
        oid = ObjectId(workbook_id)
    except Exception:
        return

    workbooks.update_one(
        {"_id": oid},
        {"$set": {"last_synced": datetime.utcnow()}},
    )


def delete_workbook(workbook_id: str) -> None:
    """
    Delete a workbook document from Mongo.
    (Deck cleanup is handled at the API level before this is called.)
    """
    try:
        oid = ObjectId(workbook_id)
    except Exception:
        return

    workbooks.delete_one({"_id": oid})
