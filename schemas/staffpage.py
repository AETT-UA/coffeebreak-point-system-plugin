from pydantic import Field
from coffeebreak.schemas import BaseComponent as BaseComponentSchema

class StaffPage(BaseComponentSchema):
    """
    Schema for Schedule component using FullCalendar

    This component renders a configurable calendar focused on shorter timeframes
    like days and weeks rather than months.
    """
    title: str = Field(..., description="Title of the schedule")
