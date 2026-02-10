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

# Add these functions to auth_repository.py (after the create_owner function)

def get_owner_info() -> Optional[Dict]:
    """
    Get the current owner's information.
    Returns None if no owner exists.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    owner = passwords.find_one({"role": "owner", "is_active": True})
    
    if not owner:
        return None
    
    return {
        "password_id": str(owner["_id"]),
        "display_name": owner.get("display_name"),
        "email": owner.get("email"),
        "created_at": owner.get("created_at")
    }


def transfer_owner(new_display_name: str, new_password: str, current_user_role: str) -> str:
    """
    Transfer ownership to a new account.
    - Current owner becomes admin
    - New account is created as owner
    
    Can only be called by current owner or dev.
    Returns the new owner's password_id.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    # Find current owner
    current_owner = passwords.find_one({"role": "owner", "is_active": True})
    
    if not current_owner:
        raise ValueError("No current owner exists")
    
    # Demote current owner to admin
    passwords.update_one(
        {"_id": current_owner["_id"]},
        {"$set": {"role": "admin"}}
    )
    
    # Create new owner
    now = datetime.utcnow()
    new_owner_doc = {
        "display_name": new_display_name,
        "password_hash": _hash_password(new_password),
        "role": "owner",
        "is_active": True,
        "created_at": now,
        "created_by": current_owner.get("display_name", "Unknown")
    }
    
    result = passwords.insert_one(new_owner_doc)
    return str(result.inserted_id)


def relinquish_owner(owner_password_id: str) -> None:
    """
    Owner voluntarily gives up ownership.
    Owner account becomes admin.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    # Verify this is actually the owner
    owner = passwords.find_one({"_id": ObjectId(owner_password_id), "role": "owner"})
    
    if not owner:
        raise ValueError("Not the current owner")
    
    # Demote to admin
    passwords.update_one(
        {"_id": ObjectId(owner_password_id)},
        {"$set": {"role": "admin"}}
    )


def update_owner_profile(owner_password_id: str, display_name: Optional[str] = None, email: Optional[str] = None) -> None:
    """
    Update owner's display name and/or email.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    update_fields = {}
    if display_name:
        update_fields["display_name"] = display_name.strip()
    if email is not None:  # Allow empty string to clear email
        update_fields["email"] = email.strip() if email else None
    
    if not update_fields:
        return
    
    passwords.update_one(
        {"_id": ObjectId(owner_password_id), "role": "owner"},
        {"$set": update_fields}
    )


def update_owner_password(owner_password_id: str, new_password: str) -> None:
    """
    Update owner's password.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    password_hash = _hash_password(new_password)
    
    passwords.update_one(
        {"_id": ObjectId(owner_password_id), "role": "owner"},
        {"$set": {"password_hash": password_hash}}
    )

# ---------- Account Management Functions ----------


def list_all_accounts() -> list[Dict]:
    """
    Get all accounts from the passwords collection.
    Returns list of account info (excludes password hashes for security).
    
    Used by Account Management page to show all users.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    accounts = []
    for doc in passwords.find().sort("created_at", -1):  # Newest first
        accounts.append({
            "account_id": str(doc["_id"]),
            "display_name": doc.get("display_name", "Unknown"),
            "email": doc.get("email"),
            "role": doc.get("role", "operator"),
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at"),
            "created_by": doc.get("created_by"),
        })
    
    return accounts


def create_account(display_name: str, password: str, role: str, email: Optional[str] = None, created_by: str = "Admin") -> str:
    """
    Create a new account (admin or operator only - NOT owner).
    
    Owner accounts must be created through create_owner() or transfer_owner().
    
    Returns the new account's password_id.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    # Prevent creating owner accounts through this function
    if role == "owner":
        raise ValueError("Cannot create owner accounts through this method. Use transfer_owner() instead.")
    
    # Validate role
    if role not in ("admin", "operator"):
        raise ValueError("Role must be 'admin' or 'operator'")
    
    # Check if display name already exists
    existing = passwords.find_one({"display_name": display_name})
    if existing:
        raise ValueError(f"An account with display name '{display_name}' already exists")
    
    now = datetime.utcnow()
    doc = {
        "display_name": display_name,
        "password_hash": _hash_password(password),
        "role": role,
        "email": email.strip() if email else None,
        "is_active": True,
        "created_at": now,
        "created_by": created_by
    }
    
    result = passwords.insert_one(doc)
    return str(result.inserted_id)


def get_account_by_id(account_id: str) -> Optional[Dict]:
    """
    Get a single account's details by ID.
    Returns None if not found.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    try:
        doc = passwords.find_one({"_id": ObjectId(account_id)})
    except:
        return None
    
    if not doc:
        return None
    
    return {
        "account_id": str(doc["_id"]),
        "display_name": doc.get("display_name", "Unknown"),
        "email": doc.get("email"),
        "role": doc.get("role", "operator"),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at"),
        "created_by": doc.get("created_by"),
    }


def update_account(account_id: str, display_name: Optional[str] = None, email: Optional[str] = None, role: Optional[str] = None) -> None:
    """
    Update an account's display name, email, or role.
    
    Cannot change owner role through this function (use transfer_owner).
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    # Get current account
    try:
        current = passwords.find_one({"_id": ObjectId(account_id)})
    except:
        raise ValueError("Invalid account ID")
    
    if not current:
        raise ValueError("Account not found")
    
    # Prevent modifying owner accounts
    if current.get("role") == "owner":
        raise ValueError("Cannot modify owner account through this method")
    
    # Build update fields
    update_fields = {}
    
    if display_name is not None:
        # Check if new name is taken
        existing = passwords.find_one({"display_name": display_name, "_id": {"$ne": ObjectId(account_id)}})
        if existing:
            raise ValueError(f"Display name '{display_name}' is already taken")
        update_fields["display_name"] = display_name.strip()
    
    if email is not None:
        update_fields["email"] = email.strip() if email else None
    
    if role is not None:
        if role not in ("admin", "operator"):
            raise ValueError("Role must be 'admin' or 'operator'")
        update_fields["role"] = role
    
    if not update_fields:
        return
    
    passwords.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": update_fields}
    )


def disable_account(account_id: str) -> None:
    """
    Disable an account (soft delete - sets is_active to False).
    Account can be re-enabled later.
    
    Cannot disable owner accounts.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    try:
        account = passwords.find_one({"_id": ObjectId(account_id)})
    except:
        raise ValueError("Invalid account ID")
    
    if not account:
        raise ValueError("Account not found")
    
    if account.get("role") == "owner":
        raise ValueError("Cannot disable owner account")
    
    passwords.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"is_active": False}}
    )


def enable_account(account_id: str) -> None:
    """
    Re-enable a disabled account.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    try:
        passwords.update_one(
            {"_id": ObjectId(account_id)},
            {"$set": {"is_active": True}}
        )
    except:
        raise ValueError("Invalid account ID")


def delete_account(account_id: str) -> None:
    """
    Permanently delete an account (hard delete).
    
    Cannot delete owner accounts - use transfer_owner or relinquish_owner instead.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    try:
        account = passwords.find_one({"_id": ObjectId(account_id)})
    except:
        raise ValueError("Invalid account ID")
    
    if not account:
        raise ValueError("Account not found")
    
    if account.get("role") == "owner":
        raise ValueError("Cannot delete owner account")
    
    passwords.delete_one({"_id": ObjectId(account_id)})


def update_account_password(account_id: str, new_password: str) -> None:
    """
    Update any account's password (admin function).
    Used when admin needs to reset someone's password.
    
    Cannot change owner password through this - owner must use update_owner_password.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    from bson import ObjectId
    
    try:
        account = passwords.find_one({"_id": ObjectId(account_id)})
    except:
        raise ValueError("Invalid account ID")
    
    if not account:
        raise ValueError("Account not found")
    
    if account.get("role") == "owner":
        raise ValueError("Cannot change owner password through this method")
    
    password_hash = _hash_password(new_password)
    
    passwords.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"password_hash": password_hash}}
    )

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


# ---------- Password Reset Tokens (Email-Based) ----------


def create_password_reset_token(email: str, ttl_hours: int = 1) -> Optional[str]:
    """
    Create a password reset token for a user with the given email.
    
    Returns the token string if email exists, None if email not found.
    Token expires in 1 hour by default.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    # Find account with this email
    account = passwords.find_one({"email": email, "is_active": True})
    if not account:
        return None
    
    # Create token
    tokens = db[ADMIN_RESET_TOKENS_COLLECTION]
    token = secrets.token_urlsafe(32)
    now = datetime.utcnow()
    expires_at = now + timedelta(hours=ttl_hours)
    
    tokens.insert_one({
        "token": token,
        "email": email,
        "account_id": str(account["_id"]),
        "requested_at": now,
        "expires_at": expires_at,
        "used": False,
    })
    
    return token


def validate_password_reset_token(token: str) -> Optional[Dict]:
    """
    Validate a password reset token without consuming it.
    
    Returns account info if valid: {"account_id": str, "email": str, "expires_at": datetime}
    Returns None if token is invalid, expired, or already used.
    """
    db = get_db()
    tokens = db[ADMIN_RESET_TOKENS_COLLECTION]
    
    doc = tokens.find_one({"token": token})
    if not doc:
        return None
    
    if doc.get("used"):
        return None
    
    expires_at = doc.get("expires_at")
    if isinstance(expires_at, datetime) and expires_at < datetime.utcnow():
        return None
    
    return {
        "account_id": doc.get("account_id"),
        "email": doc.get("email"),
        "expires_at": expires_at,
    }


def use_password_reset_token(token: str, new_password: str) -> bool:
    """
    Consume a password reset token and update the user's password.
    
    Returns True if successful.
    Returns False if token is invalid, expired, or already used.
    """
    db = get_db()
    tokens = db[ADMIN_RESET_TOKENS_COLLECTION]
    passwords = db[PASSWORDS_COLLECTION]
    
    # Validate token
    token_info = validate_password_reset_token(token)
    if not token_info:
        return False
    
    from bson import ObjectId
    
    # Update password
    account_id = token_info["account_id"]
    password_hash = _hash_password(new_password)
    
    result = passwords.update_one(
        {"_id": ObjectId(account_id)},
        {"$set": {"password_hash": password_hash}}
    )
    
    if result.modified_count == 0:
        return False
    
    # Mark token as used
    tokens.update_one(
        {"token": token},
        {"$set": {"used": True}}
    )
    
    return True


def get_account_by_email(email: str) -> Optional[Dict]:
    """
    Get account info by email address.
    Returns None if not found.
    """
    db = get_db()
    passwords = db[PASSWORDS_COLLECTION]
    
    doc = passwords.find_one({"email": email, "is_active": True})
    if not doc:
        return None
    
    return {
        "account_id": str(doc["_id"]),
        "display_name": doc.get("display_name"),
        "email": doc.get("email"),
        "role": doc.get("role"),
    }


# ---------- OLD: Admin reset tokens (DEPRECATED) ----------


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