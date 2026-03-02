from pydantic import Field

from coffeebreak.schemas import BaseComponent as BaseComponentSchema


class MyPointsPage(BaseComponentSchema):
    """Schema for the personal points component shown in event app pages."""

    title: str = Field(
        default="My Points",
        description="Title shown above the points information",
        optional=True,
    )
    show_transactions: bool = Field(
        default=True,
        description="Whether to show transaction history",
        optional=True,
    )
    transaction_limit: int = Field(
        default=10,
        ge=1,
        description="Maximum number of transactions to display",
        optional=True,
    )
