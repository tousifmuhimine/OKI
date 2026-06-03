from pydantic import BaseModel
from datetime import datetime

class DocumentOut(BaseModel):
    id: str
    organization_id: str
    lead_id: str | None = None
    customer_id: str | None = None
    name: str
    file_type: str
    file_url: str
    uploaded_by_id: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
