from pydantic import BaseModel


class NutrientOut(BaseModel):
    code: str
    name: str
    unit: str
    category: str
    parent_code: str | None
    nrv: float | None
    sort_order: int

    model_config = {"from_attributes": True}
