from pydantic import Field
from coffeebreak.schemas import BaseComponent as BaseComponentSchema


class StaffPage(BaseComponentSchema):
    """
    Schema for the staff QR scanning and point attribution component.
    """

    title: str = Field(..., description="Title shown on the staff scanner page")
