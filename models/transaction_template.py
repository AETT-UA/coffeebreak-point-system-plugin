from sqlalchemy import Column, Double, Integer, Text, DateTime, String
from sqlalchemy.sql import func
from coffeebreak.dependencies.database import Base


class TransactionTemplate(Base):
    __tablename__ = "transaction_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    original_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    activity_id = Column(Integer, nullable=True)
    points = Column(Double, nullable=False)
    description = Column(Text, nullable=True)
    claim_limit = Column(Integer, nullable=True, default=0)
