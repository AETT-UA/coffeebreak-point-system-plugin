from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from coffeebreak.dependencies.database import Base


class TransactionTemplateUserPermission(Base):
    __tablename__ = "transaction_template_user_permissions"
    __table_args__ = (
        UniqueConstraint("template_id", "user_sub", name="uq_template_user_permission"),
    )

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(
        Integer, ForeignKey("transaction_templates.id"), nullable=False, index=True
    )
    user_sub = Column(String, nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TransactionTemplateRolePermission(Base):
    __tablename__ = "transaction_template_role_permissions"
    __table_args__ = (
        UniqueConstraint(
            "template_id", "role_name", name="uq_template_role_permission"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(
        Integer, ForeignKey("transaction_templates.id"), nullable=False, index=True
    )
    role_name = Column(String, nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
