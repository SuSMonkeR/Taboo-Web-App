from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..config import settings


router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str


# simple static token for now
STATIC_TOKEN = "staff-token-abc"


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    if body.password != settings.STAFF_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password.")

    return LoginResponse(token=STATIC_TOKEN)
