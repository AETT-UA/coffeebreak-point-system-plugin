from pydantic import Field
from coffeebreak.schemas import BaseComponent as BaseComponentSchema

<<<<<<< HEAD

class StaffPage(BaseComponentSchema):
    """
    Schema for the staff QR scanning and point attribution component.
    """

    title: str = Field(..., description="Title shown on the staff scanner page")
=======
class StaffPage(BaseComponentSchema):
    """
    Schema for Schedule component using FullCalendar

    This component renders a configurable calendar focused on shorter timeframes
    like days and weeks rather than months.
    """
    title: str = Field(..., description="Title of the schedule")
>>>>>>> 3074779d6b7bfbaff6e5344cc7e2a6c797820e86
