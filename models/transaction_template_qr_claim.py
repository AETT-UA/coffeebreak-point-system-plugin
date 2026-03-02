from sqlalchemy import Column, Integer, DateTime, String
from sqlalchemy.sql import func

from coffeebreak.dependencies.database import Base


class TransactionTemplateQrClaim(Base):
    __tablename__ = "transaction_template_qr_claims"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, nullable=False, index=True)
    user_sub = Column(String, nullable=False, index=True)
    transaction_id = Column(Integer, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
