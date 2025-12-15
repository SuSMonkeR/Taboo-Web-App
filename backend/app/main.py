# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, health, library, workbooks
from .auth_repository import ensure_default_roles
from .mongo_client import ping_mongo
from .config import settings

app = FastAPI(title="Taboo Staff Backend")


def _mask_mongo_uri(uri: str) -> str:
    """
    Hide the password portion of a MongoDB URI for safe logging.
    Example:
        mongodb+srv://user:******@cluster.mongodb.net/....
    """
    if "://" not in uri or "@" not in uri:
        return uri

    try:
        prefix, rest = uri.split("://", 1)
        creds, host = rest.split("@", 1)
        if ":" in creds:
            user, _pw = creds.split(":", 1)
            return f"{prefix}://{user}:******@{host}"
        return uri
    except Exception:
        return uri


def _build_cors_origins():
    """
    CORS must NOT use allow_origins=["*"] when allow_credentials=True.
    We build an explicit allowlist based on env + local dev defaults.
    """
    origins = []

    # Primary: configured frontend URL (Render / production)
    frontend = (getattr(settings, "REACT_FRONTEND_URL", "") or "").strip()
    if frontend:
        origins.append(frontend)

    # Local dev defaults
    origins.extend(
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    # De-dupe while preserving order
    seen = set()
    out = []
    for o in origins:
        if o and o not in seen:
            seen.add(o)
            out.append(o)
    return out


# ✅ Correct CORS config (explicit allowlist + credentials allowed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    """
    Perform necessary initialization:
      - Load & print effective configuration values
      - Ping MongoDB to confirm connectivity
      - Seed initial staff/admin roles only if ping succeeds
    """
    print("=== Backend Startup: Initializing MongoDB ===")
    print("Effective MONGODB_URI:", _mask_mongo_uri(settings.MONGODB_URI))

    ok = ping_mongo()
    if ok:
        print("MongoDB connection OK.")
        ensure_default_roles()
        print("Role initialization complete.")
    else:
        print("WARNING: Could not ping MongoDB. Check MONGODB_URI and network access.")
        print("Skipping role initialization due to failed Mongo connection.")

    # Helpful CORS debug line (safe)
    print("CORS allow_origins:", _build_cors_origins())

    print("=== Backend Startup Complete ===")


@app.get("/")
async def root():
    return {"message": "Backend running"}


# Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(library.router)
app.include_router(workbooks.router)
