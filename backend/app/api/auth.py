from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt

from ..config import settings
from ..auth_repository import (
    ensure_default_roles,
    get_user_by_password,
    owner_exists,
    create_owner,
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
    role: str  # "dev" | "owner" | "admin" | "operator"
    display_name: str


class CreateOwnerRequest(BaseModel):
    display_name: str
    password: str


class OwnerExistsResponse(BaseModel):
    exists: bool


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


security = HTTPBearer()


async def get_current_role(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Extract and validate the role from the Authorization header (Bearer <token>).
    """
    token = credentials.credentials
    role = decode_access_token(token)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
        )
    return role


def require_admin_or_dev(role: str = Depends(get_current_role)) -> str:
    """
    Dependency to require that the current user is admin, owner, or dev.
    """
    if role not in ("admin", "owner", "dev"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return role


def require_dev_only(role: str = Depends(get_current_role)) -> str:
    """
    Dependency to require dev-only access.
    """
    if role != "dev":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev access required.",
        )
    return role


# ---------- Routes ----------


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    """
    Attempt to log in with a password.

    The password is checked against:
    - DEV_PASSWORD from env (role = dev)
    - Individual accounts in passwords collection (owner/admin/operator)
    - Legacy roles collection for backward compatibility (admin/staff → admin/operator)
    """
    # Keep default roles seeded for backward compatibility
    ensure_default_roles()

    user = get_user_by_password(body.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid password.")

    token = create_access_token(role=user["role"])
    return LoginResponse(
        token=token, 
        role=user["role"],
        display_name=user["display_name"]
    )


@router.get("/owner-exists", response_model=OwnerExistsResponse)
async def check_owner_exists() -> OwnerExistsResponse:
    """
    Check if an Owner account exists.
    
    Used by the frontend to determine whether to show Owner setup UI.
    This endpoint does NOT require authentication (anyone can check).
    """
    return OwnerExistsResponse(exists=owner_exists())


@router.post("/create-owner", response_model=GenericResponse)
async def create_owner_account(
    body: CreateOwnerRequest,
    role: str = Depends(require_dev_only),
) -> GenericResponse:
    """
    Create the initial Owner account.
    
    Only callable by Dev, and only when no Owner exists yet.
    """
    if owner_exists():
        raise HTTPException(
            status_code=400,
            detail="Owner already exists. Use transfer functionality instead."
        )
    
    if not body.display_name or not body.display_name.strip():
        raise HTTPException(status_code=400, detail="Display name is required.")
    
    if not body.password or len(body.password) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters.")
    
    try:
        create_owner(body.display_name.strip(), body.password)
        return GenericResponse(message=f"Owner account '{body.display_name}' created successfully.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/get-staff-password",
    response_model=StaffPasswordResponse,
)
async def get_staff_password(
    role: str = Depends(require_admin_or_dev),
) -> StaffPasswordResponse:
    """
    Return the current staff password in plaintext.

    Restricted to admin/owner/dev only. This is purely for convenience in this
    small internal tool.
    
    DEPRECATED: This is for backward compatibility with old role system.
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

    Only users with role 'admin', 'owner', or 'dev' may call this.
    
    DEPRECATED: This is for backward compatibility with old role system.
    """
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
    Only users with role 'admin', 'owner', or 'dev' may call this.
    """
    if not settings.ADMIN_RESET_EMAIL:
        raise HTTPException(
            status_code=500,
            detail="Admin reset email is not configured on the server.",
        )

    token = create_admin_reset_token()
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

    ok = use_admin_reset_token(body.token)
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    update_admin_password(body.new_password)
    return GenericResponse(message="Admin password updated.")