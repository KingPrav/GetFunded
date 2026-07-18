"""VC Brain — FastAPI entrypoint.

Step 1 scope: boot the app, initialize the schema, expose a health check.
No business routes yet — those come once the schema is confirmed working.
"""
from fastapi import FastAPI

from db.database import init_db

app = FastAPI(title="VC Brain", version="0.1.0")


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "vc-brain-backend"}
