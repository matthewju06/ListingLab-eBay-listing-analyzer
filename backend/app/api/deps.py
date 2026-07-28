from fastapi import Header

from app.config import settings


def get_current_user_id(x_user_id: str | None = Header(default=None, alias="X-User-Id")) -> str:
    """Resolve the acting user.

    Until Clerk JWT verification is added, prefer ``X-User-Id`` from the client,
    otherwise fall back to ``DEV_USER_ID`` for local single-user testing.
    """
    if x_user_id and x_user_id.strip():
        return x_user_id.strip()[:128]
    return settings.dev_user_id
