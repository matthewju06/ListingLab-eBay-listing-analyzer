import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.db.models import TrackedListing
from app.db.session import get_db
from app.models.persistence import TrackedListingCreate, TrackedListingOut, TrackedListingUpdate

router = APIRouter(prefix="/api/tracked-listings", tags=["tracked-listings"])


@router.get("", response_model=list[TrackedListingOut])
def list_tracked_listings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[TrackedListing]:
    stmt = (
        select(TrackedListing)
        .where(TrackedListing.user_id == user_id)
        .order_by(TrackedListing.updated_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.post("", response_model=TrackedListingOut, status_code=status.HTTP_201_CREATED)
def create_tracked_listing(
    body: TrackedListingCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> TrackedListing:
    row = TrackedListing(
        user_id=user_id,
        title=body.title.strip(),
        item_web_url=body.item_web_url.strip(),
        image_url=body.image_url,
        condition=body.condition,
        seller_username=body.seller_username,
        last_seen_price=body.last_seen_price,
        target_min_price=body.target_min_price,
        target_max_price=body.target_max_price,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{tracked_id}", response_model=TrackedListingOut)
def get_tracked_listing(
    tracked_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> TrackedListing:
    row = db.get(TrackedListing, tracked_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Tracked listing not found")
    return row


@router.patch("/{tracked_id}", response_model=TrackedListingOut)
def update_tracked_listing(
    tracked_id: uuid.UUID,
    body: TrackedListingUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> TrackedListing:
    row = db.get(TrackedListing, tracked_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Tracked listing not found")

    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()
    if "item_web_url" in data and data["item_web_url"] is not None:
        data["item_web_url"] = data["item_web_url"].strip()
    for key, value in data.items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{tracked_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tracked_listing(
    tracked_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> None:
    row = db.get(TrackedListing, tracked_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Tracked listing not found")
    db.delete(row)
    db.commit()
