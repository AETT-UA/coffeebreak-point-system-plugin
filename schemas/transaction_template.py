from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class Base(BaseModel):
    name: str = Field(..., min_length=1, description="Template name")
    activity_id: Optional[int] = Field(None, description="Associated activity ID")
    points: float = Field(..., description="Points for this transaction")
    description: Optional[str] = Field(None, description="Template description")
    claim_limit: Optional[int] = Field(
        0, description="Max claims allowed (0 = unlimited)"
    )


class Update(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    activity_id: Optional[int] = Field(None)
    points: Optional[float] = Field(None)
    description: Optional[str] = Field(None)
    claim_limit: Optional[int] = Field(None)


class Response(Base):
    id: int
    original_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


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
