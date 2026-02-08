from datetime import datetime, timedelta
from typing import Optional, Dict
import secrets
import hashlib
import hmac

from .config import settings
from .mongo_client import get_db

ROLES_COLLECTION = "roles"  # OLD - being deprecated
PASSWORDS_COLLECTION = "passwords"  # NEW - individual accounts with display names
ADMIN_RESET_TOKENS_COLLECTION = "admin_reset_tokens"


# ---------- Simple hashing helpers (no bcrypt drama) ----------


def _hash_password(password: str) -> str:
    """
    Hash a plaintext password using SHA-256 with a static salt.

    This is NOT bank-grade crypto, but is perfectly adequate for a small,
    internal tool where we just don't want to store plaintext for auth
    comparison.
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


# ---------- NEW: User lookup with display names ----------


def get_user_by_password(password: str) -> Optional[Dict[str, str]]:
    """
    Given a plaintext password, return user info:
    {
        "display_name": str,
        "role": "dev" | "owner" | "admin" | "operator",
        "password_id": str | None
    }
    
    Returns None if no match.
    
    Checks in order:
    1. Dev password (env-only, never in database)
    2. New passwords collection (individual accounts with display names)
    3. Old roles collection (for backward compatibility during transition)
    """
    # Check dev first (env-only, not stored in DB)
    if settings.DEV_PASSWORD and password == settings.DEV_PASSWORD:
        return {
            "display_name": "Dev",
            "role": "dev",
            "password_id": None
        }

    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]

    # Check new passwords collection (individual accounts)
    for doc in passwords.find({"is_active": True}):
        password_hash = doc.get("password_hash")
        if isinstance(password_hash, str) and _verify_password(password, password_hash):
            return {
                "display_name": doc.get("display_name", "Unknown"),
                "role": doc.get("role", "operator"),
                "password_id": str(doc["_id"])
            }

    # Fallback: check old roles collection for backward compatibility
    # This allows existing staff/admin passwords to keep working during transition
    roles = db[ROLES_COLLECTION]
    for role_name in ("admin", "staff"):
        doc = roles.find_one({"role": role_name})
        if not doc:
            continue
        password_hash = doc.get("password_hash")
        if isinstance(password_hash, str) and _verify_password(password, password_hash):
            # Map old roles to new roles
            mapped_role = "admin" if role_name == "admin" else "operator"
            return {
                "display_name": f"Legacy {role_name.title()}",
                "role": mapped_role,
                "password_id": None  # Old system doesn't have password IDs
            }

    return None


def owner_exists() -> bool:
    """
    Check if an Owner account exists in the passwords collection.
    Used to determine if we should show Owner setup UI.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    owner_doc = passwords.find_one({"role": "owner", "is_active": True})
    return owner_doc is not None


def create_owner(display_name: str, password: str) -> str:
    """
    Create the initial Owner account.
    This should only be called when no Owner exists.
    
    Returns the password_id of the created owner.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    # Safety check: don't create if owner already exists
    if owner_exists():
        raise ValueError("Owner already exists")
    
    now = datetime.utcnow()
    doc = {
        "display_name": display_name,
        "password_hash": _hash_password(password),
        "role": "owner",
        "is_active": True,
        "created_at": now,
        "created_by": "Dev"
    }
    
    result = passwords.insert_one(doc)
    return str(result.inserted_id)


# ---------- OLD FUNCTIONS (deprecated, kept for backward compatibility) ----------


def ensure_default_roles() -> None:
    """
    DEPRECATED: This function is being phased out in favor of UI-driven account creation.
    
    Kept for backward compatibility during transition.
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


def get_role_by_password(password: str) -> Optional[str]:
    """
    DEPRECATED: Use get_user_by_password() instead.
    
    Kept for backward compatibility.
    """
    user = get_user_by_password(password)
    return user["role"] if user else None


def _set_role_password(role: str, new_password: str) -> None:
    """
    DEPRECATED: Old role-based password system.
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
    """DEPRECATED: Update the shared staff password in Mongo."""
    _set_role_password("staff", new_password)


def update_admin_password(new_password: str) -> None:
    """DEPRECATED: Update the shared admin password in Mongo."""
    _set_role_password("admin", new_password)


def get_staff_password_plain() -> Optional[str]:
    """
    DEPRECATED: Return the current staff password in plaintext.
    """
    db = get_db()
    roles = db[ROLES_COLLECTION]
    doc = roles.find_one({"role": "staff"})
    if not doc:
        return settings.STAFF_DEFAULT_PASSWORD or None

    pw = doc.get("password_plain")
    if isinstance(pw, str) and pw:
        return pw

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