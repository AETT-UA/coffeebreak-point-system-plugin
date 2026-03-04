from coffeebreak.utils.api import Router
from fastapi import HTTPException, Query, Depends, Path, Body
from typing import List, Optional
import logging
import json
from fastapi.responses import JSONResponse
from coffeebreak.dependencies.database import get_db  # type: ignore
from sqlalchemy.orm import Session  # type: ignore

from ..schemas.point_system import (
    ActivityAwardRequest,
    SimpleUser,
    Transaction,
    TransactionRequest,
    TransactionType,
)
from ..services.point_system_service import (
    PointSystemService,
    PointSystemUnavailable,
    UpstreamPointSystemError,
    UserIdMappingError,
)
from ..services.transaction_template_service import TransactionTemplateService
from coffeebreak.dependencies.auth import check_role, get_current_user

logger = logging.getLogger("coffeebreak.point_system")

router = Router()
ROLE = "manage_transaction_templates"
BYPASS_ROLE = "manage_all_point_transactions"


def _raise_upstream(e: UpstreamPointSystemError):
    try:
        body = json.loads(e.detail)
    except Exception:
        body = {"detail": e.detail}
    return JSONResponse(status_code=e.status_code, content=body)


async def _enforce_activity_claim_limit(
    user_id: str,
    activity_id: int,
    template_id: int,
    template_name: str,
    claim_limit: Optional[int],
    claim_limit_mode: Optional[str],
    template_service: TransactionTemplateService,
):
    if claim_limit is None:
        return

    try:
        normalized_limit = int(claim_limit)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail=(
                f"Template '{template_name}' has invalid claim_limit '{claim_limit}'. "
                "Use 0 for unlimited or a positive integer."
            ),
        )

    if normalized_limit <= 0:
        return

    normalized_mode = str(claim_limit_mode or "per_user").strip().lower()
    if normalized_mode not in {"per_user", "overall"}:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Template '{template_name}' has invalid claim_limit_mode '{claim_limit_mode}'. "
                "Use 'per_user' or 'overall'."
            ),
        )

    if normalized_mode == "overall":
        claims_count = template_service.count_qr_claims_overall(template_id)
        if claims_count >= normalized_limit:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Claim limit reached for template '{template_name}'. "
                    f"It allows at most {normalized_limit} claims in total."
                ),
            )
        return

    claims_count = template_service.count_qr_claims_for_user(template_id, user_id)

    if claims_count >= normalized_limit:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Claim limit reached for template '{template_name}'. "
                f"It allows at most {normalized_limit} successful claims per participant."
            ),
        )


@router.get("/health")
async def health_check():
    try:
        return await PointSystemService.health.check()
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=502, detail="Point system unreachable")


@router.get("/transactions", response_model=List[Transaction])
async def list_transactions(
    activity_id: Optional[int] = Query(None, description="Filter by activity"),
    user_id: Optional[str] = Query(None, description="Filter by user"),
    transaction_type: Optional[str] = Query(
        None, description="Filter by type (manual, activity)"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, gt=0, le=100),
    _: dict = Depends(check_role([ROLE])),
):
    try:
        return await PointSystemService.transactions.list(
            activity_id=activity_id,
            user_id=user_id,
            transaction_type=transaction_type,
            skip=skip,
            limit=limit,
        )
    except UserIdMappingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to list transactions: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve transactions")


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
async def get_activity_leaderboard(
    activity_id: int = Path(..., description="Activity identifier"),
):
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
        raise HTTPException(
            status_code=500, detail="Failed to retrieve activity leaderboard"
        )


@router.get("/points/{user_id}")
async def get_user_points(user_id: str = Path(..., description="User identifier")):
    """
    Get user points.

    Returns the current points balance for a user.
    """
    try:
        points = await PointSystemService.points.get(user_id)
        return {"user_id": user_id, "points": points}
    except UserIdMappingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to get points for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user points")


@router.get("/points/{user_id}/history", response_model=List[Transaction])
async def get_user_history(user_id: str = Path(..., description="User identifier")):
    """
    Get user points history.

    Returns the chronological list of points transactions for a user.
    """
    try:
        return await PointSystemService.points.get_history(user_id)
    except UserIdMappingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to get history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user history")


@router.get("/points/{user_id}/activity/{activity_id}")
async def get_user_activity_points(
    user_id: str = Path(..., description="User identifier"),
    activity_id: int = Path(..., description="Activity identifier"),
):
    """
    Get user points in activity.

    Returns the points a user has accumulated within a specific activity.
    """
    try:
        points = await PointSystemService.points.get_in_activity(user_id, activity_id)
        return {"user_id": user_id, "activity_id": activity_id, "points": points}
    except UserIdMappingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(
            f"Failed to get activity points for user {user_id} in activity {activity_id}: {e}"
        )
        raise HTTPException(
            status_code=500, detail="Failed to retrieve activity points"
        )


@router.post("/points/{user_id}/add")
async def add_points(
    user_id: str = Path(..., description="User identifier"),
    transaction: TransactionRequest = Body(...),
    transaction_type: TransactionType = TransactionType.MANUAL,
    _: dict = Depends(check_role([ROLE, BYPASS_ROLE])),
):
    """
    Add points to user.

    Creates a points transaction for a user. Use transaction_type=activity to associate to an activity.
    """
    try:
        if transaction_type == TransactionType.MANUAL:
            description = (transaction.description or "").strip()
            if not description:
                raise HTTPException(
                    status_code=422,
                    detail="Description is required for manual point attribution.",
                )
            transaction.description = description

        if (
            transaction_type == TransactionType.ACTIVITY
            and transaction.activity_id is None
        ):
            raise HTTPException(
                status_code=422,
                detail="activity_id is required when transaction_type is activity.",
            )

        result = await PointSystemService.points.create_transaction(
            user_id, transaction, transaction_type
        )
        if result:
            return {"message": "Points added successfully", "transaction": result}
        else:
            raise HTTPException(status_code=500, detail="Failed to create transaction")
    except UserIdMappingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add points for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add points")


@router.post("/points/{user_id}/add-activity/{activity_id}")
async def add_activity_points(
    user_id: str = Path(..., description="User identifier"),
    activity_id: int = Path(..., description="Activity identifier"),
    payload: Optional[ActivityAwardRequest] = Body(None),
    db: Session = Depends(get_db),
    user_info: dict = Depends(get_current_user()),
):
    """
    Add activity participation points to a user using the configured activity template.

    Requires exactly one transaction template configured for the given activity.
    """
    try:
        template_service = TransactionTemplateService(db)
        templates = template_service.list_templates_for_activity(activity_id)

        if len(templates) == 0:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No transaction template configured for activity {activity_id}. "
                    "Create one activity template before awarding activity points."
                ),
            )

        executable_templates = [
            template
            for template in templates
            if template_service.can_execute_template(template.id, user_info, ROLE)
        ]

        if len(executable_templates) == 0:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Access denied for activity {activity_id}. "
                    "You need manage_transaction_templates role or template ACL permission."
                ),
            )

        template: Optional[object] = None

        if len(executable_templates) == 1:
            template = executable_templates[0]
        else:
            # Multiple templates exist; require explicit selection
            requested_template_id = (
                int(payload.template_id)
                if payload is not None and payload.template_id is not None
                else None
            )

            if requested_template_id is None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Multiple accessible transaction templates configured for activity {activity_id}. "
                        "Specify template_id to choose which one to use."
                    ),
                )

            for candidate in executable_templates:
                if int(candidate.id) == requested_template_id:
                    template = candidate
                    break

            if template is None:
                if any(
                    int(candidate.id) == requested_template_id
                    for candidate in templates
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Access denied for template {requested_template_id}.",
                    )

                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Template {requested_template_id} not found for activity {activity_id}."
                    ),
                )
        points_mode = str(
            getattr(template, "points_mode", "automatic") or "automatic"
        ).lower()

        if points_mode not in {"automatic", "manual"}:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Template '{template.name}' has invalid points_mode '{points_mode}'. "
                    "Use 'automatic' or 'manual'."
                ),
            )

        if points_mode == "automatic":
            points = PointSystemService._round_points(template.points)
        else:
            if payload is None or payload.points is None:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Template '{template.name}' requires manual points input. "
                        "Provide points in request body."
                    ),
                )
            points = payload.points

        if points <= 0:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Template '{template.name}' for activity {activity_id} has invalid points. "
                    "Points must be an integer greater than zero."
                ),
            )

        description = (template.description or "").strip() or (
            f"Participation points for activity {activity_id}"
        )

        await _enforce_activity_claim_limit(
            user_id=user_id,
            activity_id=activity_id,
            template_id=template.id,
            template_name=template.name,
            claim_limit=template.claim_limit,
            claim_limit_mode=getattr(template, "claim_limit_mode", "per_user"),
            template_service=template_service,
        )

        transaction = TransactionRequest(
            activity_id=activity_id,
            points=points,
            description=description,
        )

        result = await PointSystemService.points.create_transaction(
            user_id,
            transaction,
            TransactionType.ACTIVITY,
        )

        if result:
            template_service.register_qr_claim(
                template_id=template.id,
                user_sub=user_id,
                transaction_id=result.id,
            )

            return {
                "message": "Activity points added successfully",
                "activity_id": activity_id,
                "template_id": template.id,
                "template_name": template.name,
                "points_mode": points_mode,
                "awarded_points": points,
                "transaction": result,
            }

        raise HTTPException(
            status_code=500, detail="Failed to create activity transaction"
        )
    except UserIdMappingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Failed to add activity points for user {user_id} in activity {activity_id}: {e}"
        )
        raise HTTPException(status_code=500, detail="Failed to add activity points")


@router.post("/points/{user_id}/remove")
async def remove_points(
    user_id: str = Path(..., description="User identifier"),
    points: int = Query(..., description="Points to remove"),
    description: str = Query(..., description="Reason for removal"),
    activity_id: Optional[int] = Query(
        None, description="Optional activity identifier"
    ),
    _: dict = Depends(check_role([BYPASS_ROLE])),
):
    """
    Remove points from user.

    Removes points from a user by creating a negative transaction.
    """
    try:
        success = await PointSystemService.points.remove(
            user_id=user_id,
            points=points,
            description=description,
            activity_id=activity_id,
        )
        if success:
            return {
                "message": "Points removed successfully",
                "user_id": user_id,
                "points_removed": points,
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to remove points")
    except UserIdMappingError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PointSystemUnavailable as e:
        raise HTTPException(status_code=502, detail=str(e))
    except UpstreamPointSystemError as e:
        return _raise_upstream(e)
    except Exception as e:
        logger.error(f"Failed to remove points from user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove points")
