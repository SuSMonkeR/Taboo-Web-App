from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database

from .config import settings


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    """
    Return a singleton MongoClient instance, configured from settings.MONGODB_URI.

    Using @lru_cache ensures we only create one client per process, which is
    the recommended pattern for pymongo.
    """
    uri = settings.MONGODB_URI
    client = MongoClient(uri)
    return client


def get_db() -> Database:
    """
    Get the main application database as configured in settings.MONGODB_DB_NAME.
    """
    client = get_mongo_client()
    db_name = settings.MONGODB_DB_NAME
    return client[db_name]


def ping_mongo() -> bool:
    """
    Try to ping the MongoDB deployment. Returns True if successful, False otherwise.

    This is useful to call at startup (e.g. in app.main) to fail fast if the URI
    or network config is wrong.
    """
    try:
        client = get_mongo_client()
        client.admin.command("ping")
        return True
    except Exception as e:
        print("Mongo ping failed:", e)
        return False
