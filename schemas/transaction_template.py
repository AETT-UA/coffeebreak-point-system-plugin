from pydantic import BaseModel, Field          # type: ignore
from typing import Optional
from datetime import datetime

class Base(BaseModel):
    """
    Base schema for Transaction templates
    Attributes:
        name (str): Unique name for the template
        template (str): Message template with placeholders
    """
    name: str       = Field(..., min_length=1, description="Unique name for the template")
    template: str   = Field(..., min_length=1, description="Message template with JSON placeholders (e.g., '{ \"user_id\": \"{user_id}\", ... }')")

class Update(BaseModel):
    """
    Schema for updating Transaction template fields
    All fields are optional since it's a partial update
    """
    name:Optional[str]      = Field(None, min_length=1)
    template:Optional[str]  = Field(None, min_length=1)

class Response(Base):
    """
    Schema for Transaction template response
    Includes database fields like id and timestamps
    """
    id: int
    created_at: datetime
    updated_at: datetime
