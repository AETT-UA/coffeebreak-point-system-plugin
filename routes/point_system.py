from utils.api import Router  # type: ignore
from fastapi import HTTPException, Query, Depends
from typing import List, Optional
import logging

from ..schemas.point_system import SimpleUser, Transaction, TransactionRequest, TransactionType
from ..services.point_system_service import PointSystemService

logger = logging.getLogger("coffeebreak.point_system")

router = Router()

@router.get("/leaderboard", response_model=List[SimpleUser])
async def get_global_leaderboard():
    """Get global leaderboard"""
    try:
        return await PointSystemService.leaderboard.get()
    except Exception as e:
        logger.error(f"Failed to get global leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve leaderboard")

@router.get("/leaderboard/{activity_id}", response_model=List[SimpleUser])
async def get_activity_leaderboard(activity_id: int):
    """Get leaderboard for specific activity"""
    try:
        return await PointSystemService.leaderboard.get_activity(activity_id)
    except Exception as e:
        logger.error(f"Failed to get activity leaderboard for {activity_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity leaderboard")

@router.get("/points/{user_id}")
async def get_user_points(user_id: int):
    """Get current points for a user"""
    try:
        points = await PointSystemService.points.get(user_id)
        return {"user_id": user_id, "points": points}
    except Exception as e:
        logger.error(f"Failed to get points for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user points")

@router.get("/points/{user_id}/history", response_model=List[Transaction])
async def get_user_history(user_id: int):
    """Get transaction history for a user"""
    try:
        return await PointSystemService.points.get_history(user_id)
    except Exception as e:
        logger.error(f"Failed to get history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user history")

@router.get("/points/{user_id}/activity/{activity_id}")
async def get_user_activity_points(user_id: int, activity_id: int):
    """Get points for a user in a specific activity"""
    try:
        points = await PointSystemService.points.get_in_activity(user_id, activity_id)
        return {"user_id": user_id, "activity_id": activity_id, "points": points}
    except Exception as e:
        logger.error(f"Failed to get activity points for user {user_id} in activity {activity_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity points")

@router.post("/points/{user_id}/add")
async def add_points(user_id: int, transaction: TransactionRequest, transaction_type: TransactionType = TransactionType.MANUAL):
    """Add points to a user"""
    try:
        result = await PointSystemService.points.create_transaction(user_id, transaction, transaction_type)
        if result:
            return {"message": "Points added successfully", "transaction": result}
        else:
            raise HTTPException(status_code=500, detail="Failed to create transaction")
    except Exception as e:
        logger.error(f"Failed to add points for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add points")

@router.post("/points/{user_id}/remove")
async def remove_points(user_id: int, points: float, description: str):
    """Remove points from a user"""
    try:
        success = await PointSystemService.points.remove(user_id, points)
        if success:
            return {"message": "Points removed successfully", "user_id": user_id, "points_removed": points}
        else:
            raise HTTPException(status_code=500, detail="Failed to remove points")
    except Exception as e:
        logger.error(f"Failed to remove points from user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove points")

