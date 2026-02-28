from typing import List, Optional  # type: ignore
import logging
import httpx
from urllib.parse import urljoin

from ..schemas.point_system import (
    SimpleUser,
    Transaction,
    TransactionRequest,
    TransactionType,
)

logger = logging.getLogger("coffeebreak.point_system")


class PointSystemUnavailable(Exception):
    pass


class UpstreamPointSystemError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class PointSystemService:
    """Service for integrating with external point system"""

    def __init__(self):
        # Default configuration - will be overridden by plugin settings
        self.base_url = "http://point-system.deti4devs.pt"
        self.timeout = 30.0
        self.retry_attempts = 3
        self.client = None

        logger.info("PointSystemService initialized with default configuration")

    def _load_settings_from_module(self):
        """Load plugin settings from the in-memory plugin module registry"""
        try:
            from plugin_loader import plugins_modules  # lazy import to avoid cycles

            if "coffeebreak-point-system-plugin" in plugins_modules:
                plugin_module = plugins_modules["coffeebreak-point-system-plugin"]
                if hasattr(plugin_module, "SETTINGS"):
                    settings = plugin_module.SETTINGS
                    self.base_url = settings.point_system_url
                    self.timeout = float(settings.connection_timeout)
                    self.retry_attempts = int(settings.retry_attempts)
                    logger.info(
                        f"Loaded plugin settings: URL={self.base_url}, Timeout={self.timeout}s"
                    )
                    return True
            logger.warning("Plugin module or SETTINGS not found, using defaults")
            return False
        except Exception as e:
            logger.warning(f"Failed to load plugin settings, using defaults: {e}")
            return False

    async def _ensure_client(self):
        """Ensure HTTP client is initialized with current settings"""
        if self.client is None:
            # Try to load settings from module
            self._load_settings_from_module()
            self.client = httpx.AsyncClient(timeout=self.timeout)

    async def __aenter__(self):
        await self._ensure_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    def _get_url(self, endpoint: str) -> str:
        """Build full URL for endpoint"""
        return urljoin(self.base_url, endpoint)

    async def _make_request(self, method: str, endpoint: str, **kwargs) -> dict:
        """Make HTTP request to external service with retry logic"""
        await self._ensure_client()
        url = self._get_url(endpoint)

        for attempt in range(self.retry_attempts):
            try:
                response = await self.client.request(method, url, **kwargs)
                response.raise_for_status()
                return response.json() if response.content else {}
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"HTTP error {e.response.status_code} for {url}: {e.response.text}"
                )
                if attempt == self.retry_attempts - 1:
                    raise UpstreamPointSystemError(
                        e.response.status_code, e.response.text
                    )
                logger.info(
                    f"Retrying request (attempt {attempt + 1}/{self.retry_attempts})"
                )
            except (httpx.ConnectError, httpx.ConnectTimeout) as e:
                logger.error(f"Connection error for {url}: {e}")
                if attempt == self.retry_attempts - 1:
                    raise PointSystemUnavailable(
                        f"Point system service is unreachable at {self.base_url}"
                    )
                logger.info(
                    f"Retrying request (attempt {attempt + 1}/{self.retry_attempts})"
                )
            except httpx.RequestError as e:
                logger.error(f"Request error for {url}: {e}")
                if attempt == self.retry_attempts - 1:
                    raise PointSystemUnavailable(f"Point system request failed: {e}")
                logger.info(
                    f"Retrying request (attempt {attempt + 1}/{self.retry_attempts})"
                )
            except Exception as e:
                logger.error(f"Unexpected error for {url}: {e}")
                raise

<<<<<<< HEAD
        raise PointSystemUnavailable(
            f"Point system service at {self.base_url} did not respond after {self.retry_attempts} attempts"
        )
=======
        raise PointSystemUnavailable(f"Point system service at {self.base_url} did not respond after {self.retry_attempts} attempts")
>>>>>>> 3074779d6b7bfbaff6e5344cc7e2a6c797820e86

    def _safe_int_compare(self, value1, value2):
        """Safely compare two values that should be integers, handling string conversion"""
        try:
            if value1 is None:
                return value2 is None
            if value2 is None:
                return value1 is None
            return int(value1) == int(value2)
        except (ValueError, TypeError):
            return False

    class leaderboard:
        @classmethod
        async def get(cls) -> List[SimpleUser]:
            """
            Retrieve the general leaderboard of users with their points.
            Returns:
                List of SimpleUser objects representing the leaderboard.
            """
            try:
                service = PointSystemService()
                async with service:
                    data = await service._make_request("GET", "/leaderboard/")
                    # Convert LeaderboardEntry to SimpleUser with explicit casting
                    return [
                        SimpleUser(
                            id=str(entry["user_id"]), points=float(entry["points"])
                        )
                        for entry in data
                    ]
            except Exception as e:
                logger.error(f"Failed to get global leaderboard: {e}")
                raise

        @classmethod
        async def get_activity(cls, activity_id: int) -> List[SimpleUser]:
            """
            Retrieve the leaderboard of a specific activity.
            Args:
                activity_id: ID of the activity to get the leaderboard for.
            Returns:
                List of SimpleUser objects representing the leaderboard for the activity.
            """
            try:
                service = PointSystemService()
                async with service:
                    data = await service._make_request(
                        "GET", f"/leaderboard/{activity_id}/"
                    )
                    # Convert LeaderboardEntry to SimpleUser with explicit casting
                    return [
                        SimpleUser(
                            id=str(entry["user_id"]), points=float(entry["points"])
                        )
                        for entry in data
                    ]
            except Exception as e:
                logger.error(
                    f"Failed to get activity leaderboard for {activity_id}: {e}"
                )
                raise

    class points:
        @classmethod
        async def get(cls, user_id: str) -> float:
            """
            Retrieve the points of a specific user.
            Args:
                user_id: ID of the user to get points for.
            Returns:
                Points of the user.
            """
            try:
                service = PointSystemService()
                async with service:
                    # Get user history and calculate current balance
                    data = await service._make_request(
                        "GET", f"/points/{user_id}/history"
                    )
                    history = data.get("history") if isinstance(data, dict) else None
                    if isinstance(history, list) and history:
                        total = 0.0
                        for tx in history:
                            try:
                                total += float(tx.get("points", 0))
                            except (ValueError, TypeError):
                                continue
                        return max(0, total)
                    return 0.0
            except Exception as e:
                logger.error(f"Failed to get points for user {user_id}: {e}")
                raise

        @classmethod
        async def remove(cls, user_id: str, points: float) -> bool:
            """
            Remove points from a specific user.
            Args:
                user_id: ID of the user to remove points from.
                points: Number of points to remove.
            Returns:
                True if points were successfully removed, False otherwise.
            """
            try:
                service = PointSystemService()
                async with service:
                    removal_data = {
                        "points": points,
                        "description": f"Manual removal of {points} points",
                    }
                    await service._make_request(
                        "POST", f"/points/{user_id}/remove", json=removal_data
                    )
                    logger.info(
                        f"Successfully removed {points} points from user {user_id}"
                    )
                    return True
            except Exception as e:
                logger.error(
                    f"Failed to remove {points} points from user {user_id}: {e}"
                )
                return False

        @classmethod
        async def get_history(cls, user_id: str) -> List[Transaction]:
            """
            Retrieve the transaction history of a specific user.
            Args:
                user_id: ID of the user to get points history for.
            Returns:
                List of Transaction objects representing the points history.
            """
            try:
                service = PointSystemService()
                async with service:
                    data = await service._make_request(
                        "GET", f"/points/{user_id}/history"
                    )
                    history = data.get("history") if isinstance(data, dict) else None
                    if isinstance(history, list):
                        transactions = []
                        for tx_data in history:
                            try:
                                tx_id = (
                                    int(tx_data["id"])
                                    if tx_data.get("id") is not None
                                    else None
                                )
                                tx_user_id = (
                                    str(tx_data["user_id"])
                                    if tx_data.get("user_id") is not None
                                    else None
                                )
                                tx_activity_id = (
                                    int(tx_data["activity_id"])
                                    if tx_data.get("activity_id") is not None
                                    else None
                                )
                                tx_issued_by_id = (
                                    str(tx_data["issued_by_id"])
                                    if tx_data.get("issued_by_id") is not None
                                    else None
                                )
                                tx_points = (
                                    float(tx_data["points"])
                                    if tx_data.get("points") is not None
                                    else 0.0
                                )
                                if tx_id is None or tx_user_id is None:
                                    continue
                                tx = Transaction(
                                    id=tx_id,
                                    activity_id=tx_activity_id,
                                    user_id=tx_user_id,
                                    issued_by_id=tx_issued_by_id,
                                    points=tx_points,
                                    transaction_type=TransactionType(
                                        tx_data["transaction_type"]
                                    ),
                                    description=tx_data.get("description"),
                                    created_at=tx_data["created_at"],
                                )
                                transactions.append(tx)
                            except (ValueError, TypeError, KeyError):
                                continue
                        return transactions
                    return []
            except Exception as e:
                logger.error(f"Failed to get history for user {user_id}: {e}")
                raise

        @classmethod
        async def get_in_activity(cls, user_id: str, activity_id: int) -> float:
            """
            Retrieve the points of a specific user in a specific activity.
            Args:
                user_id: ID of the user to get points for.
                activity_id: ID of the activity to get points for.
            Returns:
                Points of the user in the activity.
            """
            try:
                service = PointSystemService()
                async with service:
                    # Get user history and filter by activity
                    data = await service._make_request(
                        "GET", f"/points/{user_id}/history"
                    )
                    if "history" in data and data["history"]:
                        # Calculate balance for specific activity
                        activity_balance = sum(
<<<<<<< HEAD
                            float(tx["points"])
                            for tx in data["history"]
                            if service._safe_int_compare(
                                tx.get("activity_id"), activity_id
                            )
=======
                            float(tx['points']) for tx in data['history']
                            if service._safe_int_compare(tx.get('activity_id'), activity_id)
>>>>>>> 3074779d6b7bfbaff6e5344cc7e2a6c797820e86
                        )
                        return max(0, activity_balance)
                    return 0.0
            except Exception as e:
                logger.error(
                    f"Failed to get points for user {user_id} in activity {activity_id}: {e}"
                )
                raise

        @classmethod
        async def create_transaction(
            cls,
            user_id: str,
            transaction: TransactionRequest,
            transaction_type: TransactionType,
        ) -> Optional[Transaction]:
            """
            Create a new transaction for a user.
            Args:
                user_id: ID of the user to create the transaction for.
                transaction: TransactionRequest object containing the details of the transaction.
                transaction_type: Type of the transaction (e.g., 'manual', 'activity').
            Returns:
                Transaction object if the transaction was successfully created, None otherwise.
            """
            try:
                service = PointSystemService()
                async with service:
                    # Prepare transaction data for external service
                    tx_data = {
                        "points": transaction.points,
                        "description": transaction.description,
                        "activity_id": transaction.activity_id,
                    }

                    # Map internal transaction type to external service type
<<<<<<< HEAD
                    type_param = (
                        "activity"
                        if transaction_type == TransactionType.ACTIVITY
                        else "manual"
                    )

                    data = await service._make_request(
                        "POST", f"/points/{user_id}/add?type={type_param}", json=tx_data
                    )

=======
                    type_param = "activity" if transaction_type == TransactionType.ACTIVITY else "manual"

                    data = await service._make_request(
                        'POST',
                        f'/points/{user_id}/add?type={type_param}',
                        json=tx_data
                    )

>>>>>>> 3074779d6b7bfbaff6e5344cc7e2a6c797820e86
                    # Convert response to internal Transaction format with proper type casting
                    try:
                        return Transaction(
                            id=int(data["id"]),
                            activity_id=int(data["activity_id"])
                            if data.get("activity_id") is not None
                            else None,
                            user_id=str(data["user_id"]),
                            issued_by_id=str(data["issued_by_id"])
                            if data.get("issued_by_id") is not None
                            else None,
                            points=float(data["points"]),
                            transaction_type=TransactionType(data["transaction_type"]),
                            description=data.get("description"),
                            created_at=data["created_at"],
                        )
                    except (ValueError, TypeError) as e:
                        logger.error(
                            f"Invalid transaction data from external service: {e}, data: {data}"
                        )
                        raise ValueError(f"External service returned invalid data: {e}")
            except Exception as e:
                logger.error(f"Failed to create transaction for user {user_id}: {e}")
                raise
