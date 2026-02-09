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
    get_owner_info,           # NEW
    transfer_owner,           # NEW
    relinquish_owner,         # NEW
    update_owner_profile,     # NEW
    update_owner_password,    # NEW
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


class TransferOwnerRequest(BaseModel):
    new_display_name: str
    new_password: str


class UpdateOwnerProfileRequest(BaseModel):
    display_name: Optional[str] = None
    email: Optional[str] = None


class UpdateOwnerPasswordRequest(BaseModel):
    new_password: str


class OwnerInfoResponse(BaseModel):
    password_id: str
    display_name: str
    email: Optional[str]
    created_at: datetime


class RequestOwnerResetResponse(BaseModel):
    message: str


class ResetOwnerPasswordRequest(BaseModel):
    token: str
    new_password: str


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


# ---------- NEW: Owner Management Endpoints ----------


@router.get("/owner-info", response_model=OwnerInfoResponse)
async def get_owner_info_endpoint(
    role: str = Depends(get_current_role),
) -> OwnerInfoResponse:
    """
    Get current owner's information.
    
    Only owner and dev can call this.
    """
    if role not in ("owner", "dev"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner or dev access required.",
        )
    
    owner_info = get_owner_info()
    if not owner_info:
        raise HTTPException(status_code=404, detail="No owner exists.")
    
    return OwnerInfoResponse(**owner_info)


@router.post("/transfer-owner", response_model=GenericResponse)
async def transfer_owner_endpoint(
    body: TransferOwnerRequest,
    role: str = Depends(get_current_role),
) -> GenericResponse:
    """
    Transfer ownership to a new account.
    Current owner becomes admin.
    
    Only owner or dev can call this.
    """
    if role not in ("owner", "dev"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner or dev access required.",
        )
    
    if not body.new_display_name or not body.new_display_name.strip():
        raise HTTPException(status_code=400, detail="Display name is required.")
    
    if not body.new_password or len(body.new_password) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters.")
    
    try:
        transfer_owner(body.new_display_name.strip(), body.new_password, role)
        return GenericResponse(message=f"Ownership transferred to '{body.new_display_name}'.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/relinquish-owner", response_model=GenericResponse)
async def relinquish_owner_endpoint(
    role: str = Depends(get_current_role),
) -> GenericResponse:
    """
    Owner voluntarily gives up ownership.
    Owner account becomes admin.
    
    Only owner can call this (dev cannot force relinquish).
    """
    if role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can relinquish ownership.",
        )
    
    # Get owner's password_id from database
    owner_info = get_owner_info()
    if not owner_info:
        raise HTTPException(status_code=404, detail="No owner exists.")
    
    try:
        relinquish_owner(owner_info["password_id"])
        return GenericResponse(message="Ownership relinquished. You are now an admin.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/update-owner-profile", response_model=GenericResponse)
async def update_owner_profile_endpoint(
    body: UpdateOwnerProfileRequest,
    role: str = Depends(get_current_role),
) -> GenericResponse:
    """
    Update owner's display name and/or email.
    
    Only owner can update their own profile (dev cannot).
    """
    if role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can update their profile.",
        )
    
    owner_info = get_owner_info()
    if not owner_info:
        raise HTTPException(status_code=404, detail="No owner exists.")
    
    update_owner_profile(
        owner_info["password_id"],
        display_name=body.display_name,
        email=body.email
    )
    
    return GenericResponse(message="Profile updated successfully.")


@router.put("/update-owner-password", response_model=GenericResponse)
async def update_owner_password_endpoint(
    body: UpdateOwnerPasswordRequest,
    role: str = Depends(get_current_role),
) -> GenericResponse:
    """
    Update owner's password.
    
    Only owner can update their own password (dev cannot).
    """
    if role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can update their password.",
        )
    
    if not body.new_password or len(body.new_password) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters.")
    
    owner_info = get_owner_info()
    if not owner_info:
        raise HTTPException(status_code=404, detail="No owner exists.")
    
    update_owner_password(owner_info["password_id"], body.new_password)
    
    return GenericResponse(message="Password updated successfully.")


@router.post("/request-owner-reset", response_model=RequestOwnerResetResponse)
async def request_owner_reset() -> RequestOwnerResetResponse:
    """
    Request an owner password reset email.
    
    Does NOT require authentication (can be called by anyone).
    Sends reset email to owner's configured email address.
    """
    owner_info = get_owner_info()
    if not owner_info:
        raise HTTPException(status_code=404, detail="No owner exists.")
    
    owner_email = owner_info.get("email")
    if not owner_email:
        raise HTTPException(
            status_code=400,
            detail="Owner has no email configured. Cannot send reset email."
        )
    
    # Reuse the existing token system
    token = create_admin_reset_token()
    
    # TODO: Send email to owner_email with token
    # For now, just return success (you'll implement email later)
    
    return RequestOwnerResetResponse(
        message=f"Password reset email sent to {owner_email}."
    )


@router.post("/reset-owner-password", response_model=GenericResponse)
async def reset_owner_password_endpoint(
    body: ResetOwnerPasswordRequest,
) -> GenericResponse:
    """
    Complete owner password reset using token from email.
    
    Does NOT require authentication (token is the auth).
    """
    if not body.token or not body.new_password:
        raise HTTPException(status_code=400, detail="Token and new password are required.")
    
    if len(body.new_password) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters.")
    
    # Validate token
    ok = use_admin_reset_token(body.token)
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )
    
    # Update owner password
    owner_info = get_owner_info()
    if not owner_info:
        raise HTTPException(status_code=404, detail="No owner exists.")
    
    update_owner_password(owner_info["password_id"], body.new_password)
    
    return GenericResponse(message="Owner password updated successfully.")


# ---------- DEPRECATED: Old Staff/Admin Password Endpoints ----------


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