from pydantic import BaseModel, Field, field_validator  # type: ignore
from typing import Optional, List
from datetime import datetime


class Base(BaseModel):
    """
    Base schema for Transaction templates
    Attributes:
        name (str): Unique name for the template
        points (float): Points associated with the transaction
    """

    name: str = Field(..., min_length=1, description="Unique name for the template")
    activity_id: Optional[int] = Field(
        None, description="ID of the associated activity"
    )
    points: float = Field(..., description="Points associated with the transaction")
    description: Optional[str] = Field(
        None, description="Description of the transaction template"
    )
    claim_limit: Optional[int] = Field(
        0, description="Maximum number of claims allowed for this template (0 = unlimited)"
    )


class Update(BaseModel):
    """
    Schema for updating Transaction template fields
    All fields are optional since it's a partial update
    """

    name: Optional[str] = Field(
        None, min_length=1, description="Unique name for the template"
    )
    activity_id: Optional[int] = Field(
        None, description="ID of the associated activity"
    )
    points: Optional[float] = Field(
        None, description="Points associated with the transaction"
    )
    description: Optional[str] = Field(
        None, description="Description of the transaction template"
    )
    claim_limit: Optional[int] = Field(
        None, description="Maximum number of claims allowed for this template"
    )


class Response(Base):
    """
    Schema for Transaction template response
    Includes database fields like id and timestamps
    """

    id: int
    original_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    @field_validator("points", mode="before")
    @classmethod
    def normalize_points(cls, value):
        if value is None:
            return value

        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return value

        # Since points is now float, just return the float value
        return numeric


class ExecuteRequest(BaseModel):
    user_id: str = Field(..., min_length=1, description="Target user identifier")


class UserPermissionCreate(BaseModel):
    user_sub: str = Field(..., min_length=1, description="User subject claim (sub)")


class RolePermissionCreate(BaseModel):
    role_name: str = Field(..., min_length=1, description="Role name")


class PermissionsResponse(BaseModel):
    template_id: int
    user_subs: List[str]
    role_names: List[str]
