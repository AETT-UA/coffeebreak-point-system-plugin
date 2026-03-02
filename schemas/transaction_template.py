from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class PointsMode(str, Enum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"


class Base(BaseModel):
    name: str = Field(..., min_length=1, description="Template name")
    activity_id: Optional[int] = Field(None, description="Associated activity ID")
    points: int = Field(
        0,
        description=(
            "Points for this transaction. Used when points_mode is automatic; ignored when manual."
        ),
    )
    points_mode: PointsMode = Field(
        default=PointsMode.AUTOMATIC,
        description=(
            "automatic uses template points directly; manual requires staff to enter points after scan"
        ),
    )
    description: Optional[str] = Field(None, description="Template description")
    claim_limit: Optional[int] = Field(
        0, description="Max claims allowed (0 = unlimited)"
    )

    @model_validator(mode="after")
    def validate_points_mode(self):
        if self.points_mode == PointsMode.AUTOMATIC and self.points <= 0:
            raise ValueError("Automatic templates require points greater than zero.")
        if self.points_mode == PointsMode.MANUAL and self.points < 0:
            raise ValueError("Manual templates require points to be zero or greater.")
        return self


class Update(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    activity_id: Optional[int] = Field(None)
    points: Optional[int] = Field(None)
    points_mode: Optional[PointsMode] = Field(None)
    description: Optional[str] = Field(None)
    claim_limit: Optional[int] = Field(None)


class Response(Base):
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

        if numeric >= 0:
            return int(numeric + 0.5)

        return int(numeric - 0.5)


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
