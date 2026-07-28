from fastapi import APIRouter

from app.api.routes import saved, search, tracking

api_router = APIRouter()
api_router.include_router(search.router)
api_router.include_router(saved.router)
api_router.include_router(tracking.router)
