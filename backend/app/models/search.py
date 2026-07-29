from pydantic import BaseModel, ConfigDict, Field


class SearchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query: str = Field(min_length=1, max_length=80)
    min_price: str = Field(default="", alias="minPrice")
    max_price: str = Field(default="", alias="maxPrice")
    category: str | None = None
    condition: str | None = None
    filter_strength: int = Field(default=4, alias="filterStrength")


class ItemSummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    title: str | None = None
    price: str = "0"
    condition: str | None = None
    item_web_url: str | None = Field(default=None, alias="itemWebUrl")
    username: str | None = None
    feedback_percentage: str | None = Field(default=None, alias="feedbackPercentage")
    category_name: str | None = Field(default=None, alias="categoryName")
    image_url: str | None = Field(default=None, alias="imageUrl")
    item_creation_date: str | None = Field(default=None, alias="itemCreationDate")


class SearchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    item_summaries: list[ItemSummary] = Field(alias="itemSummaries")
    applied_min_price: float | None = Field(default=None, alias="appliedMinPrice")
    applied_max_price: float | None = Field(default=None, alias="appliedMaxPrice")
    suggested_min_price: float | None = Field(default=None, alias="suggestedMinPrice")
    suggested_max_price: float | None = Field(default=None, alias="suggestedMaxPrice")
    suggested_coverage: float | None = Field(default=None, alias="suggestedCoverage")
