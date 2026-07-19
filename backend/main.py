"""VC Brain — FastAPI entrypoint.

Boots the app, initializes the schema, mounts the API routers, and serves the
dashboard frontend from the same origin (so there's no CORS setup needed — open one
URL locally and the whole thing works).
"""
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from api.decision import router as decision_router
from api.founders import router as founders_router
from api.screening import router as screening_router
from api.sourcing import router as sourcing_router
from db.database import init_db

app = FastAPI(title="VC Brain", version="0.1.0")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "vc-brain-backend"}


app.include_router(sourcing_router)
app.include_router(screening_router)
app.include_router(decision_router)
app.include_router(founders_router)

_frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(_frontend_dir):
    app.mount("/", StaticFiles(directory=_frontend_dir, html=True), name="frontend")
