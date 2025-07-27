from pydantic import BaseModel, Field          # type: ignore
from typing import Optional
from datetime import datetime,timezone
from enum import Enum

class SimpleUser(BaseModel):
    """
    Simple user schema for leaderboard
    """
    id: int
    points: float

class TransactionType(str, Enum):
    """
    Enum for transaction types
    """
    MANUAL = "manual"
    ACTIVITY = "activity"

class Transaction(BaseModel):
    """
    Transaction schema for point system
    """
    id: int                           = Field(..., description="Unique identifier for the transaction")
    activity_id: Optional[int]        = Field(None, description="ID of the activity associated with the transaction")
    user_id: int                      = Field(..., description="ID of the user associated with the transaction")
    issued_by_id: Optional[int]       = Field(None, description="ID")
    points: float                     = Field(..., description="Points associated with the transaction")
    transaction_type: TransactionType = Field(..., description="Type of the transaction (e.g., 'manual', 'activity')")
    description: Optional[str]        = Field(None, description="Description of the transaction")
    created_at: datetime              = Field(default=datetime.now(timezone.utc), description="Timestamp when the transaction was created")

class TransactionRequest(BaseModel):
    """
    Request schema for creating a transaction
    """
    activity_id: Optional[int]        = Field(None, description="ID of the activity associated with the transaction")
    points: float                     = Field(..., description="Points to be added or subtracted")
    description: Optional[str]        = Field(None, description="Description of the transaction")
