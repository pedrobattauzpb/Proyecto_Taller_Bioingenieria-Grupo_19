from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.models.hierarchy import AssetType
from app.models.checklist import ItemType


class ChecklistItemBase(BaseModel):
    order_index: int
    code: str
    title: str
    description: Optional[str] = None
    input_type: ItemType = ItemType.BOOLEAN
    unit: Optional[str] = None
    is_mandatory: bool = True
    referencia_normativa: str = "ISO 7396-1"
    min_value: Optional[float] = None
    max_value: Optional[float] = None


class ChecklistItemCreate(ChecklistItemBase):
    template_id: int


class ChecklistItemRead(ChecklistItemBase):
    id: int
    template_id: int

    model_config = ConfigDict(from_attributes=True)


class ChecklistTemplateBase(BaseModel):
    title: str
    asset_type: AssetType
    version: str = "1.0"
    description: Optional[str] = None
    is_active: bool = True


class ChecklistTemplateCreate(ChecklistTemplateBase):
    items: List[ChecklistItemBase] = []


class ChecklistTemplateRead(ChecklistTemplateBase):
    id: int
    items: List[ChecklistItemRead] = []

    model_config = ConfigDict(from_attributes=True)
