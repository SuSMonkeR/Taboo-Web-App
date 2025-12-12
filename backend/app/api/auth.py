from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel
from jose import JWTError, jwt

from ..config import settings
from ..auth_repository import (
    ensure_default_roles,
    get_role_by_password,
    update_staff_password,
    update_admin_password,
    create_admin_reset_token,
    use_admin_reset_token,
    get_staff_password_plain,
)
from ..email_service import send_admin_reset_email

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


# ---------- Models ----------


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str
    role: str  # "staff" | "admin" | "dev"


class ChangeStaffPasswordRequest(BaseModel):
    new_password: str


class RequestAdminResetResponse(BaseModel):
    message: str


class ResetAdminPasswordRequest(BaseModel):
    token: str
    new_password: str


class GenericResponse(BaseModel):
    message: str


class StaffPasswordResponse(BaseModel):
    password: str


# ---------- JWT helpers ----------


def create_access_token(role: str, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    """
    Create a signed JWT containing the user's role and expiration time.
    """
    to_encode = {
        "role": role,
        "exp": datetime.utcnow() + timedelta(minutes=expires_minutes),
        "iat": datetime.utcnow(),
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    """
    Decode a JWT and return the role if valid, otherwise None.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        role = payload.get("role")
        if not isinstance(role, str):
            return None
        return role
    except JWTError:
        return None


# ---------- Dependencies ----------


async def get_current_role(authorization: str = Header(None)) -> str:
    """
    Extract and validate the role from the Authorization header (Bearer <token>).
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
        )

    token = authorization.split(" ", 1)[1].strip()
    role = decode_access_token(token)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )

    return role


def require_admin_or_dev(role: str = Depends(get_current_role)) -> str:
    """
    Dependency to require that the current user is admin or dev.
    """
    if role not in ("admin", "dev"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return role


# ---------- Routes ----------


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    """
    Attempt to log in with a single password.

    The password is checked against:
    - DEV_PASSWORD from env (role = dev)
    - admin hash in Mongo
    - staff hash in Mongo
    """
    # Make sure default roles are present (idempotent)
    ensure_default_roles()

    role = get_role_by_password(body.password)
    if role is None:
        raise HTTPException(status_code=401, detail="Invalid password.")

    token = create_access_token(role=role)
    return LoginResponse(token=token, role=role)


@router.get(
    "/get-staff-password",
    response_model=StaffPasswordResponse,
)
async def get_staff_password(
    role: str = Depends(require_admin_or_dev),
) -> StaffPasswordResponse:
    """
    Return the current staff password in plaintext.

    Restricted to admin/dev only. This is purely for convenience in this
    small internal tool.
    """
    pw = get_staff_password_plain()
    if pw is None:
        raise HTTPException(
            status_code=404,
            detail="Staff password not found.",
        )
    return StaffPasswordResponse(password=pw)


@router.post(
    "/change-staff-password",
    response_model=GenericResponse,
)
async def change_staff_password(
    body: ChangeStaffPasswordRequest,
    role: str = Depends(require_admin_or_dev),
) -> GenericResponse:
    """
    Change the shared staff password.

    Only users with role 'admin' or 'dev' may call this.
    """
    # Basic sanity check; no complexity rules enforced by design
    if not body.new_password:
        raise HTTPException(status_code=400, detail="New password cannot be empty.")

    update_staff_password(body.new_password)
    return GenericResponse(message="Staff password updated.")


@router.post(
    "/request-admin-reset",
    response_model=RequestAdminResetResponse,
)
async def request_admin_reset(
    role: str = Depends(require_admin_or_dev),
) -> RequestAdminResetResponse:
    """
    Request an admin password reset.

    This generates a one-time token and sends an email to ADMIN_RESET_EMAIL.
    Only users with role 'admin' or 'dev' may call this, but only the email
    owner (Kendra) can complete the reset.
    """
    if not settings.ADMIN_RESET_EMAIL:
        raise HTTPException(
            status_code=500,
            detail="Admin reset email is not configured on the server.",
        )

    token = create_admin_reset_token()
    # Send email to Kendra with the token (and optionally a link)
    send_admin_reset_email(settings.ADMIN_RESET_EMAIL, token)

    return RequestAdminResetResponse(
        message="Admin password reset email has been sent (if configured)."
    )


@router.post(
    "/reset-admin-password",
    response_model=GenericResponse,
)
async def reset_admin_password(
    body: ResetAdminPasswordRequest,
) -> GenericResponse:
    """
    Complete the admin password reset using the token from the email.

    This endpoint does NOT require an existing login; the token itself is the
    auth mechanism.
    """
    if not body.token or not body.new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required.")

    # Validate and consume the token
    ok = use_admin_reset_token(body.token)
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    update_admin_password(body.new_password)
    return GenericResponse(message="Admin password updated.")
