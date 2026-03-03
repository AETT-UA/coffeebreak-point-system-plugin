from sqlalchemy import Column, Double, Integer, Text, DateTime, String, Boolean
from sqlalchemy.sql import func
from coffeebreak.dependencies.database import Base


class TransactionTemplate(Base):
    __tablename__ = "transaction_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    activity_id = Column(Integer, nullable=True)
    qr_enabled = Column(Boolean, nullable=False, default=False, server_default="false")
    points_mode = Column(String, nullable=False, server_default="automatic")
    points = Column(Double, nullable=False)
    description = Column(Text, nullable=True)
    claim_limit = Column(Integer, nullable=True, default=0)
    claim_limit_mode = Column(
        String,
        nullable=False,
        default="per_user",
        server_default="per_user",
    )
