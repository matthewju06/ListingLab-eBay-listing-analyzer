import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id
from app.db.models import SavedSearch
from app.db.session import get_db
from app.models.persistence import SavedSearchCreate, SavedSearchOut, SavedSearchUpdate

router = APIRouter(prefix="/api/saved-searches", tags=["saved-searches"])


@router.get("", response_model=list[SavedSearchOut])
def list_saved_searches(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> list[SavedSearch]:
    stmt = (
        select(SavedSearch)
        .where(SavedSearch.user_id == user_id)
        .order_by(SavedSearch.updated_at.desc())
    )
    return list(db.scalars(stmt).all())


@router.post("", response_model=SavedSearchOut, status_code=status.HTTP_201_CREATED)
def create_saved_search(
    body: SavedSearchCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> SavedSearch:
    row = SavedSearch(
        user_id=user_id,
        name=body.name,
        query=body.query.strip(),
        category=body.category or None,
        condition=body.condition or None,
        min_price=body.min_price,
        max_price=body.max_price,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{saved_id}", response_model=SavedSearchOut)
def get_saved_search(
    saved_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> SavedSearch:
    row = db.get(SavedSearch, saved_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return row


@router.patch("/{saved_id}", response_model=SavedSearchOut)
def update_saved_search(
    saved_id: uuid.UUID,
    body: SavedSearchUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> SavedSearch:
    row = db.get(SavedSearch, saved_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Saved search not found")

    data = body.model_dump(exclude_unset=True)
    if "query" in data and data["query"] is not None:
        data["query"] = data["query"].strip()
    for key, value in data.items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)
    return row


@router.delete("/{saved_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(
    saved_id: uuid.UUID,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
) -> None:
    row = db.get(SavedSearch, saved_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=404, detail="Saved search not found")
    db.delete(row)
    db.commit()
