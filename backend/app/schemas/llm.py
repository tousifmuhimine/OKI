from typing import Dict, Optional

from pydantic import BaseModel


class UserLLMConfigCreate(BaseModel):
    provider: str
    api_key: str
    api_url: Optional[str] = None
    default_model: Optional[str] = None
    model_preferences: Optional[Dict[str, str]] = None
    automation_modes: Optional[Dict[str, str]] = None


class UserLLMConfigRead(BaseModel):
    id: str
    provider: str
    default_model: Optional[str]
    model_preferences: Dict[str, str]
    automation_modes: Dict[str, str]

    class Config:
        orm_mode = True
