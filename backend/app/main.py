from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, health, library, workbooks
from .auth_repository import ensure_default_roles
from .mongo_client import ping_mongo
from .config import settings


app = FastAPI(title="Taboo Staff Backend")

# Allow frontend dev server to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _mask_mongo_uri(uri: str) -> str:
    """
    Hide the password portion of a MongoDB URI for safe logging.
    Example:
        mongodb+srv://user:***********@cluster.mongodb.net/....
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


@app.on_event("startup")
def startup_event():
    """
    Perform necessary initialization:
      - Load & print effective configuration values
      - Ping MongoDB to confirm connectivity
      - Seed initial staff/admin roles *only if ping succeeds*
    """
    print("=== Backend Startup: Initializing MongoDB ===")

    # Debug log: show effective URI (masked)
    print("Effective MONGODB_URI:", _mask_mongo_uri(settings.MONGODB_URI))

    # Try connecting to MongoDB
    ok = ping_mongo()
    if ok:
        print("MongoDB connection OK.")
        ensure_default_roles()
        print("Role initialization complete.")
    else:
        print("WARNING: Could not ping MongoDB. Check MONGODB_URI and network access.")
        print("Skipping role initialization due to failed Mongo connection.")

    print("=== Backend Startup Complete ===")


@app.get("/")
async def root():
    return {"message": "Backend running"}


# Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(library.router)
app.include_router(workbooks.router)
