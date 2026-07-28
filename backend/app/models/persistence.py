import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SavedSearchCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, max_length=120)
    query: str = Field(min_length=1, max_length=80)
    category: str | None = Field(default=None, max_length=32)
    condition: str | None = Field(default=None, max_length=16)
    min_price: str | None = Field(default=None, alias="minPrice", max_length=32)
    max_price: str | None = Field(default=None, alias="maxPrice", max_length=32)


class SavedSearchUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(default=None, max_length=120)
    query: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = Field(default=None, max_length=32)
    condition: str | None = Field(default=None, max_length=16)
    min_price: str | None = Field(default=None, alias="minPrice", max_length=32)
    max_price: str | None = Field(default=None, alias="maxPrice", max_length=32)


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True, ser_json_by_alias=True)

    id: uuid.UUID
    user_id: str = Field(alias="userId")
    name: str | None = None
    query: str
    category: str | None = None
    condition: str | None = None
    min_price: str | None = Field(default=None, alias="minPrice")
    max_price: str | None = Field(default=None, alias="maxPrice")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class TrackedListingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str = Field(min_length=1, max_length=500)
    item_web_url: str = Field(alias="itemWebUrl", min_length=1, max_length=1000)
    image_url: str | None = Field(default=None, alias="imageUrl", max_length=1000)
    condition: str | None = Field(default=None, max_length=64)
    seller_username: str | None = Field(default=None, alias="sellerUsername", max_length=128)
    last_seen_price: float | None = Field(default=None, alias="lastSeenPrice")
    target_min_price: float | None = Field(default=None, alias="targetMinPrice")
    target_max_price: float | None = Field(default=None, alias="targetMaxPrice")
    notes: str | None = None


class TrackedListingUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    title: str | None = Field(default=None, min_length=1, max_length=500)
    item_web_url: str | None = Field(default=None, alias="itemWebUrl", max_length=1000)
    image_url: str | None = Field(default=None, alias="imageUrl", max_length=1000)
    condition: str | None = Field(default=None, max_length=64)
    seller_username: str | None = Field(default=None, alias="sellerUsername", max_length=128)
    last_seen_price: float | None = Field(default=None, alias="lastSeenPrice")
    target_min_price: float | None = Field(default=None, alias="targetMinPrice")
    target_max_price: float | None = Field(default=None, alias="targetMaxPrice")
    notes: str | None = None


class TrackedListingOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True, ser_json_by_alias=True)

    id: uuid.UUID
    user_id: str = Field(alias="userId")
    title: str
    item_web_url: str = Field(alias="itemWebUrl")
    image_url: str | None = Field(default=None, alias="imageUrl")
    condition: str | None = None
    seller_username: str | None = Field(default=None, alias="sellerUsername")
    last_seen_price: float | None = Field(default=None, alias="lastSeenPrice")
    target_min_price: float | None = Field(default=None, alias="targetMinPrice")
    target_max_price: float | None = Field(default=None, alias="targetMaxPrice")
    notes: str | None = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
