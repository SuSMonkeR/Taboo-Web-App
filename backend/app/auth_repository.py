from datetime import datetime, timedelta
from typing import Optional
import secrets
import hashlib
import hmac

from .config import settings
from .mongo_client import get_db

ROLES_COLLECTION = "roles"
ADMIN_RESET_TOKENS_COLLECTION = "admin_reset_tokens"


# ---------- Simple hashing helpers (no bcrypt drama) ----------


def _hash_password(password: str) -> str:
    """
    Hash a plaintext password using SHA-256 with a static salt.

    This is NOT bank-grade crypto, but is perfectly adequate for a small,
    internal tool where we just don't want to store plaintext for auth
    comparison. (We *also* store plaintext for staff/admin so it can be
    shown in the UI.)
    """
    if password is None:
        password = ""
    salt = settings.JWT_SECRET or "default-salt"
    data = (salt + password).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _verify_password(password: str, password_hash: str) -> bool:
    """
    Verify a plaintext password against the stored SHA-256 hash.
    """
    try:
        expected = _hash_password(password)
        # Use constant-time compare to avoid timing leaks (overkill but cheap)
        return hmac.compare_digest(expected, password_hash or "")
    except Exception:
        return False


# ---------- Role seeding / lookup ----------


def ensure_default_roles() -> None:
    """
    Ensure that the MongoDB 'roles' collection has at least staff/admin entries.

    Uses STAFF_DEFAULT_PASSWORD and ADMIN_DEFAULT_PASSWORD from settings ONLY
    if the roles do not already exist. Dev password is handled via env and is
    not stored in Mongo.
    """
    db = get_db()
    roles = db[ROLES_COLLECTION]

    now = datetime.utcnow()

    # Seed staff role if missing
    staff_doc = roles.find_one({"role": "staff"})
    if staff_doc is None and settings.STAFF_DEFAULT_PASSWORD:
        roles.insert_one(
            {
                "role": "staff",
                "password_hash": _hash_password(settings.STAFF_DEFAULT_PASSWORD),
                "password_plain": settings.STAFF_DEFAULT_PASSWORD,
                "created_at": now,
                "updated_at": now,
            }
        )

    # Seed admin role if missing
    admin_doc = roles.find_one({"role": "admin"})
    if admin_doc is None and settings.ADMIN_DEFAULT_PASSWORD:
        roles.insert_one(
            {
                "role": "admin",
                "password_hash": _hash_password(settings.ADMIN_DEFAULT_PASSWORD),
                "password_plain": settings.ADMIN_DEFAULT_PASSWORD,
                "created_at": now,
                "updated_at": now,
            }
        )

    # Dev is intentionally NOT stored here; it is checked directly against
    # settings.DEV_PASSWORD at login and cannot be changed via UI.


def get_role_by_password(password: str) -> Optional[str]:
    """
    Given a plaintext password, return the matching role:
    "dev", "admin", "staff", or None if no match.

    Dev is matched directly against settings.DEV_PASSWORD (env-only).
    Admin/staff are matched against SHA-256 hashes stored in Mongo.
    """
    # Check dev first (env-only, not stored in DB)
    if settings.DEV_PASSWORD and password == settings.DEV_PASSWORD:
        return "dev"

    db = get_db()
    roles = db[ROLES_COLLECTION]

    # Check admin, then staff
    for role_name in ("admin", "staff"):
        doc = roles.find_one({"role": role_name})
        if not doc:
            continue
        password_hash = doc.get("password_hash")
        if isinstance(password_hash, str) and _verify_password(password, password_hash):
            return role_name

    return None


def _set_role_password(role: str, new_password: str) -> None:
    """
    Internal helper to set the password for a given role in Mongo.
    Creates the role document if it does not exist.

    We store both:
    - password_hash: for comparison on login
    - password_plain: so you can view it in the UI
    """
    db = get_db()
    roles = db[ROLES_COLLECTION]

    now = datetime.utcnow()
    password_hash = _hash_password(new_password)

    roles.update_one(
        {"role": role},
        {
            "$set": {
                "role": role,
                "password_hash": password_hash,
                "password_plain": new_password,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            },
        },
        upsert=True,
    )


def update_staff_password(new_password: str) -> None:
    """Update the shared staff password in Mongo."""
    _set_role_password("staff", new_password)


def update_admin_password(new_password: str) -> None:
    """Update the shared admin password in Mongo."""
    _set_role_password("admin", new_password)


def get_staff_password_plain() -> Optional[str]:
    """
    Return the current staff password in plaintext.

    This is used ONLY for the UI "Show staff password" feature and is
    restricted to admin/dev via the API layer.
    """
    db = get_db()
    roles = db[ROLES_COLLECTION]
    doc = roles.find_one({"role": "staff"})
    if not doc:
        # no staff doc in DB – fall back to default if set
        return settings.STAFF_DEFAULT_PASSWORD or None

    pw = doc.get("password_plain")
    if isinstance(pw, str) and pw:
        return pw

    # Old docs that predate password_plain: fall back to default
    if settings.STAFF_DEFAULT_PASSWORD:
        return settings.STAFF_DEFAULT_PASSWORD

    return None

# ---------- Admin reset tokens ----------


def create_admin_reset_token(ttl_hours: int = 24) -> str:
    """
    Create a one-time admin password reset token.

    Returns the token string, which should be emailed to ADMIN_RESET_EMAIL.
    """
    db = get_db()
    tokens = db[ADMIN_RESET_TOKENS_COLLECTION]

    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    expires_at = now + timedelta(hours=ttl_hours)

    tokens.insert_one(
        {
            "token": token,
            "role": "admin",
            "requested_at": now,
            "expires_at": expires_at,
            "used": False,
        }
    )

    return token


def use_admin_reset_token(token: str) -> bool:
    """
    Validate and consume an admin reset token.

    Returns True if the token was valid and is now marked used.
    Returns False if the token does not exist, is expired, or already used.
    """
    db = get_db()
    tokens = db[ADMIN_RESET_TOKENS_COLLECTION]

    doc = tokens.find_one({"token": token})
    if not doc:
        return False

    if doc.get("used"):
        return False

    expires_at = doc.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
        return False

    tokens.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    return True
