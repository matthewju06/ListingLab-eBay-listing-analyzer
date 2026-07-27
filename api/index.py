"""Vercel Python entrypoint. Re-exports the FastAPI app with backend on sys.path."""

import sys
from pathlib import Path

_backend = Path(__file__).resolve().parent.parent / "backend"
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from app.main import app  # noqa: E402
