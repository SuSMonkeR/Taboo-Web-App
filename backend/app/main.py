from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import auth, health, library

app = FastAPI(title="Taboo Staff Backend")

# Allow frontend dev server to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Backend running"}


# Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(library.router)
