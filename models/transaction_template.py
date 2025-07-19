from sqlalchemy import Column, Integer, Text, DateTime, String # type: ignore
from sqlalchemy.sql import func                                # type: ignore
from dependencies.database import Base                         # type: ignore

class TransactionTemplate(Base):
    """
    SQLAlchemy model for transaction templates
    Stores the information about a transaction template
    """
    __tablename__ = "transaction_templates"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String, unique=True, nullable=False)
    template         = Column(Text, nullable=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
