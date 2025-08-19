"""This router just calls the tests"""

from utils.api import Router, Depends                   # type: ignore
from dependencies.database import get_db                # type: ignore
from sqlalchemy.orm import Session                      # type: ignore
import logging

from ..schemas.point_system import TransactionRequest, TransactionType
from ..services.point_system_service import PointSystemService  

router = Router()
logger = logging.getLogger("coffeebreak.point_system")

@router.get("")
async def test_point_system_service(
):
    service = PointSystemService()
    logger.debug("Testing PointSystemService.leaderboard.get()")
    logger.debug(service.leaderboard.get())

    logger.debug("Testing PointSystemService.leaderboard.get_activity() with activity_id=1")
    logger.debug(service.leaderboard.get_activity(1))


    logger.debug("Testing PointSystemService.points.get() with user_id=1")
    logger.debug(service.points.get(1))

    logger.debug("Testing PointSystemService.points.get_in_activity() with activity_id=1 and user_id=1")
    logger.debug(service.points.get_in_activity(1,1))

    logger.debug("Testing PointSystemService.points.remove() with user_id=1 and points=10")
    logger.debug(service.points.remove(1, 10))

    logger.debug("Testing PointSystemService.points.get_history() with user_id=1")
    logger.debug(service.points.get_history(1))

    tr = TransactionRequest(
        activity_id=None,
        points=10,
        description="Test transaction"
    )
    logger.debug(f"Testing PointSystemService.points.create_transaction() with TransactionRequest {tr} and user_id=1")
    service.points.create_transaction(1, tr, TransactionType.MANUAL)
