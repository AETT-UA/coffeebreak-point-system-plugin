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
    name: str                   = Field(..., min_length=1, description="Unique name for the template")
    activity_id: Optional[int]  = Field(None, description="ID of the associated activity")
    points: float               = Field(..., description="Points associated with the transaction")
    description: Optional[str]  = Field(None, description="Description of the transaction template")
    claim_limit: Optional[int]  = Field(0, description="Maximum number of claims allowed for this template")

class Update(BaseModel):
    """
    Schema for updating Transaction template fields
    All fields are optional since it's a partial update
    """
    name:Optional[str]          = Field(None, min_length=1, description="Unique name for the template")
    activity_id: Optional[int]  = Field(None, description="ID of the associated activity")
    points:      Optional[float]= Field(None, description="Points associated with the transaction")
    description: Optional[str]  = Field(None, description="Description of the transaction template")
    claim_limit: Optional[int]  = Field(None, description="Maximum number of claims allowed for this template")

class Response(Base):
    """
    Schema for Transaction template response
    Includes database fields like id and timestamps
    """
    id: int
    created_at: datetime
    updated_at: datetime
