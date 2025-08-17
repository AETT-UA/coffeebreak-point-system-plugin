from sqlalchemy import Column, Double, Integer, Text, DateTime, String # type: ignore
from sqlalchemy.sql import func                                        # type: ignore
from dependencies.database import Base                                 # type: ignore

class TransactionTemplate(Base):
    """
    SQLAlchemy model for transaction templates
    Stores the information about a transaction template
    """
    __tablename__ = "transaction_templates"

    # template fields
    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String, unique=True, nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # transaction fields
    activity_id      = Column(Integer,  nullable=True)
    points           = Column(Double,   nullable=False)
    description      = Column(Text,     nullable=True)
    claim_limit      = Column(Integer,  nullable=True, default=0)
