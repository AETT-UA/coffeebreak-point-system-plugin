from coffeebreak.utils.api import Router  # type: ignore
from fastapi import HTTPException, Query, Depends, Path
from typing import List, Optional
import logging
import json
from fastapi.responses import JSONResponse

from ..schemas.point_system import SimpleUser, Transaction, TransactionRequest, TransactionType
from ..services.point_system_service import PointSystemService, PointSystemUnavailable, UpstreamPointSystemError

logger = logging.getLogger("coffeebreak.point_system")

router = Router()

def _raise_upstream(e: UpstreamPointSystemError):
    try:
        body = json.loads(e.detail)
    except Exception:
        body = {"detail": e.detail}
    return JSONResponse(status_code=e.status_code, content=body)

@router.get("/leaderboard", response_model=List[SimpleUser])
async def get_global_leaderboard():
    """
    Get global leaderboard.

    Returns the global leaderboard with users and their total points.
    """
    try:
        return await PointSystemService.leaderboard.get()
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to get global leaderboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve leaderboard")

@router.get("/leaderboard/{activity_id}", response_model=List[SimpleUser])
async def get_activity_leaderboard(activity_id: int = Path(..., description="Activity identifier")):
    """
    Get activity leaderboard.

    Returns the leaderboard of users and points for a specific activity.
    """
    try:
        return await PointSystemService.leaderboard.get_activity(activity_id)
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to get activity leaderboard for {activity_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity leaderboard")

@router.get("/points/{user_id}")
async def get_user_points(user_id: int = Path(..., description="User identifier")):
    """
    Get user points.

    Returns the current points balance for a user.
    """
    try:
        points = await PointSystemService.points.get(user_id)
        return {"user_id": user_id, "points": points}
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to get points for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user points")

@router.get("/points/{user_id}/history", response_model=List[Transaction])
async def get_user_history(user_id: int = Path(..., description="User identifier")):
    """
    Get user points history.

    Returns the chronological list of points transactions for a user.
    """
    try:
        return await PointSystemService.points.get_history(user_id)
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to get history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user history")

@router.get("/points/{user_id}/activity/{activity_id}")
async def get_user_activity_points(
    user_id: int = Path(..., description="User identifier"),
    activity_id: int = Path(..., description="Activity identifier"),
):
    """
    Get user points in activity.

    Returns the points a user has accumulated within a specific activity.
    """
    try:
        points = await PointSystemService.points.get_in_activity(user_id, activity_id)
        return {"user_id": user_id, "activity_id": activity_id, "points": points}
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to get activity points for user {user_id} in activity {activity_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve activity points")

@router.post("/points/{user_id}/add")
async def add_points(
    user_id: int = Path(..., description="User identifier"),
    transaction: TransactionRequest = ...,
    transaction_type: TransactionType = TransactionType.MANUAL,
):
    """
    Add points to user.

    Creates a points transaction for a user. Use transaction_type=activity to associate to an activity.
    """
    try:
        result = await PointSystemService.points.create_transaction(user_id, transaction, transaction_type)
        if result:
            return {"message": "Points added successfully", "transaction": result}
        else:
            raise HTTPException(status_code=500, detail="Failed to create transaction")
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to add points for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add points")

@router.post("/points/{user_id}/remove")
async def remove_points(
    user_id: int = Path(..., description="User identifier"),
    points: float = Query(..., description="Points to remove"),
    description: str = Query(..., description="Reason for removal"),
):
    """
    Remove points from user.

    Removes points from a user by creating a negative transaction.
    """
    try:
        success = await PointSystemService.points.remove(user_id, points)
        if success:
            return {"message": "Points removed successfully", "user_id": user_id, "points_removed": points}
        else:
            raise HTTPException(status_code=500, detail="Failed to remove points")
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to remove points from user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove points")

