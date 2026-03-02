from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import asyncio
import logging
import httpx
from urllib.parse import urljoin
from coffeebreak.services.plugin_service import get_plugin_settings
from time import monotonic
from hashlib import sha256
from datetime import datetime, timezone

from coffeebreak.auth import get_user, list_users

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


class UserIdMappingError(Exception):
    pass


class PointSystemService:
    """Service for integrating with external point system"""

    _user_name_cache: Dict[str, Tuple[float, dict]] = {}
    _user_name_cache_ttl_seconds = 300
    _external_user_name_cache: Tuple[float, Dict[int, dict]] = (0, {})

    def __init__(self):
        # Default configuration - will be overridden by plugin settings
        self.base_url = "http://point-system.deti4devs.pt"
        self.timeout = 30.0
        self.retry_attempts = 3
        self.client = None

        logger.info("PointSystemService initialized with default configuration")

    def _load_settings_from_module(self):
        """Load plugin settings from plugin service"""
        try:
            settings = get_plugin_settings("coffeebreak-point-system-plugin")
            self.base_url = settings.get("point_system_url", self.base_url)
            self.timeout = float(settings.get("connection_timeout", self.timeout))
            self.retry_attempts = int(
                settings.get("retry_attempts", self.retry_attempts)
            )
            logger.info(
                f"Loaded plugin settings: URL={self.base_url}, Timeout={self.timeout}s"
            )
            return True
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

        raise PointSystemUnavailable(
            f"Point system service at {self.base_url} did not respond after {self.retry_attempts} attempts"
        )

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

    @staticmethod
    def _round_points(value) -> int:
        """Round a numeric point value to the nearest integer (half away from zero)."""
        numeric = float(value)

        if numeric >= 0:
            return int(numeric + 0.5)

        return int(numeric - 0.5)

    @staticmethod
    def _parse_int(value) -> Optional[int]:
        if value is None:
            return None

        if isinstance(value, bool):
            return None

        if isinstance(value, int):
            return value

        if isinstance(value, float):
            if value.is_integer():
                return int(value)
            return None

        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            try:
                return int(stripped)
            except ValueError:
                return None

        return None

    @classmethod
    def _extract_coffeebreak_numeric_id(cls, user: dict) -> Optional[int]:
        if not isinstance(user, dict):
            return None

        candidate_fields = [
            user.get("coffeebreak_id"),
            user.get("coffeebreakId"),
            user.get("point_system_user_id"),
            user.get("pointSystemUserId"),
        ]

        attributes = user.get("attributes")
        if isinstance(attributes, dict):
            for key in (
                "coffeebreak_id",
                "coffeebreakId",
                "point_system_user_id",
                "pointSystemUserId",
            ):
                candidate = attributes.get(key)
                if isinstance(candidate, list):
                    candidate = candidate[0] if candidate else None
                candidate_fields.append(candidate)

        for candidate in candidate_fields:
            parsed = cls._parse_int(candidate)
            if parsed is not None:
                return parsed

        return None

    @staticmethod
    def _display_name_from_user(user: dict, fallback: str) -> str:
        if not isinstance(user, dict):
            return fallback

        first_name = str(user.get("firstName") or "").strip()
        last_name = str(user.get("lastName") or "").strip()
        full_name = f"{first_name} {last_name}".strip()
        username = str(user.get("username") or "").strip()

        return full_name or username or fallback

    @staticmethod
    def _fallback_external_user_id(coffeebreak_user_id: str) -> int:
        digest = sha256(coffeebreak_user_id.encode("utf-8")).digest()
        value = int.from_bytes(digest[:4], byteorder="big") & 0x7FFFFFFF

        if value < 1_000_000_000:
            value += 1_000_000_000

        return value

    @classmethod
    async def _resolve_external_user_id(cls, user_id: str) -> int:
        parsed_direct = cls._parse_int(user_id)
        if parsed_direct is not None:
            return parsed_direct

        try:
            user = await get_user(user_id)
        except Exception as e:
            raise UserIdMappingError(
                f"Could not resolve CoffeeBreak user '{user_id}' to a numeric point-system user id: {e}"
            ) from e

        mapped_id = cls._extract_coffeebreak_numeric_id(user)
        if mapped_id is None:
            mapped_id = cls._fallback_external_user_id(user_id)
            logger.warning(
                "User %s has no explicit coffeebreak_id mapping; using deterministic fallback id %s",
                user_id,
                mapped_id,
            )

        return mapped_id

    @classmethod
    async def _get_external_user_name_map(cls) -> Dict[int, dict]:
        now = monotonic()
        expires_at, cached = cls._external_user_name_cache
        if cached and expires_at > now:
            return cached

        resolved: Dict[int, dict] = {}
        try:
            users = await list_users()
            for user in users:
                external_id = cls._extract_coffeebreak_numeric_id(user)
                if external_id is None:
                    keycloak_user_id = str(user.get("id") or "").strip()
                    if keycloak_user_id:
                        external_id = cls._fallback_external_user_id(keycloak_user_id)
                if external_id is None:
                    continue

                resolved[external_id] = {
                    "name": cls._display_name_from_user(user, fallback=str(external_id)),
                    "username": user.get("username") or user.get("email")
                }
        except Exception as e:
            logger.warning(f"Failed to build external user id -> name map: {e}")

        cls._external_user_name_cache = (
            now + cls._user_name_cache_ttl_seconds,
            resolved,
        )
        return resolved

    @classmethod
    async def _resolve_user_name(cls, user_id: str) -> str:
        """Resolve display name for a CoffeeBreak user id with a short TTL cache."""
        user_data = await cls._get_user_data(user_id)
        return user_data["name"]

    @classmethod
    async def _get_user_data(cls, user_id: str) -> dict:
        """Get user display name and username from Keycloak."""
        now = monotonic()
        cached = cls._user_name_cache.get(user_id)
        if cached and cached[0] > now:
            return cached[1]

        user_data = {"name": user_id, "username": None}

        try:
            user = await get_user(user_id)
            user_data["name"] = cls._display_name_from_user(user, fallback=user_id)
            user_data["username"] = user.get("username") or user.get("email")
        except Exception as e:
            parsed_external_id = cls._parse_int(user_id)
            if parsed_external_id is not None:
                external_data = await cls._get_external_user_name_map()
                fetched = external_data.get(parsed_external_id, {})
                user_data["name"] = fetched.get("name", user_id)
                user_data["username"] = fetched.get("username")
            else:
                logger.warning(f"Failed to resolve user data for {user_id}: {e}")

        cls._user_name_cache[user_id] = (
            now + cls._user_name_cache_ttl_seconds,
            user_data,
        )
        return user_data

    @classmethod
    async def _build_leaderboard_entries(cls, data: list) -> List[SimpleUser]:
        """Convert upstream leaderboard payload into enriched leaderboard entries."""
        raw_entries = []

        if not isinstance(data, list):
            return []

        for raw_entry in data:
            try:
                user_id = str(raw_entry["user_id"])
                points = cls._round_points(raw_entry["points"])
            except (KeyError, TypeError, ValueError):
                continue

            raw_entries.append((user_id, points))

        if not raw_entries:
            return []

        unique_user_ids = list(dict.fromkeys(user_id for user_id, _ in raw_entries))
        resolved_data = await asyncio.gather(
            *(cls._get_user_data(user_id) for user_id in unique_user_ids)
        )
        data_by_id = dict(zip(unique_user_ids, resolved_data))

        return [
            SimpleUser(
                id=user_id,
                name=data_by_id.get(user_id, {}).get("name", user_id),
                username=data_by_id.get(user_id, {}).get("username"),
                points=points
            )
            for user_id, points in raw_entries
        ]

    class health:
        @classmethod
        async def check(cls) -> dict:
            try:
                service = PointSystemService()
                async with service:
                    return await service._make_request("GET", "/health")
            except Exception as e:
                logger.error(f"Health check failed: {e}")
                raise

    class transactions:
        @classmethod
        async def list(
            cls,
            activity_id: Optional[int] = None,
            user_id: Optional[int] = None,
            transaction_type: Optional[str] = None,
            skip: int = 0,
            limit: int = 50,
        ) -> List[Transaction]:
            try:
                service = PointSystemService()
                async with service:
                    params: dict[str, object] = {"skip": skip, "limit": limit}
                    if activity_id is not None:
                        params["activity_id"] = activity_id
                    if user_id is not None:
                        params["user_id"] = user_id
                    if transaction_type is not None:
                        params["transaction_type"] = transaction_type
                    data = await service._make_request(
                        "GET", "/points/transactions", params=params
                    )
                    results = []
                    for tx_data in data:
                        try:
                            results.append(
                                Transaction(
                                    id=int(tx_data["id"]),
                                    activity_id=int(tx_data["activity_id"])
                                    if tx_data.get("activity_id") is not None
                                    else None,
                                    user_id=str(tx_data["user_id"]),
                                    issued_by_id=str(tx_data["issued_by_id"])
                                    if tx_data.get("issued_by_id") is not None
                                    else None,
                                    points=float(tx_data["points"]),
                                    transaction_type=TransactionType(
                                        tx_data["transaction_type"]
                                    ),
                                    description=tx_data.get("description"),
                                    created_at=tx_data["created_at"],
                                )
                            )
                        except (ValueError, TypeError, KeyError):
                            continue
                    return results
            except Exception as e:
                logger.error(f"Failed to list transactions: {e}")
                raise

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
                    return await PointSystemService._build_leaderboard_entries(data)
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
                    return await PointSystemService._build_leaderboard_entries(data)
            except Exception as e:
                logger.error(
                    f"Failed to get activity leaderboard for {activity_id}: {e}"
                )
                raise

    class points:
        @classmethod
        async def get(cls, user_id: str) -> int:
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
                    external_user_id = await service._resolve_external_user_id(user_id)
                    # Get user history and calculate current balance
                    data = await service._make_request(
                        "GET", f"/points/{external_user_id}/history"
                    )
                    history = data.get("history") if isinstance(data, dict) else None
                    if isinstance(history, list) and history:
                        total = 0
                        for tx in history:
                            try:
                                total += service._round_points(tx.get("points", 0))
                            except (ValueError, TypeError):
                                continue
                        return max(0, total)
                    return 0
            except Exception as e:
                logger.error(f"Failed to get points for user {user_id}: {e}")
                raise

        @classmethod
        async def remove(
            cls,
            user_id: str,
            points: float,
            description: str,
            activity_id: Optional[int] = None,
        ) -> bool:
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
                    external_user_id = await service._resolve_external_user_id(user_id)
                    removal_data = {
                        "activity_id": activity_id,
                        "points": points,
                        "description": description,
                    }
                    await service._make_request(
                        "POST", f"/points/{external_user_id}/remove", json=removal_data
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
                    external_user_id = await service._resolve_external_user_id(user_id)
                    data = await service._make_request(
                        "GET", f"/points/{external_user_id}/history"
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
                                    service._round_points(tx_data["points"])
                                    if tx_data.get("points") is not None
                                    else 0
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
        async def get_in_activity(cls, user_id: str, activity_id: int) -> int:
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
                    external_user_id = await service._resolve_external_user_id(user_id)
                    # Get user history and filter by activity
                    data = await service._make_request(
                        "GET", f"/points/{external_user_id}/history"
                    )
                    if "history" in data and data["history"]:
                        # Calculate balance for specific activity
                        activity_balance = sum(
                            service._round_points(tx["points"])
                            for tx in data["history"]
                            if service._safe_int_compare(
                                tx.get("activity_id"), activity_id
                            )
                        )
                        return max(0, activity_balance)
                    return 0
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
                    external_user_id = await service._resolve_external_user_id(user_id)
                    # Prepare transaction data for external service
                    tx_data: dict[str, object] = {
                        "points": transaction.points,
                        "description": transaction.description,
                        "activity_id": transaction.activity_id,
                    }

                    if transaction_type == TransactionType.ACTIVITY:
                        tx_data["timestamp"] = datetime.now(timezone.utc).isoformat()

                    # Map internal transaction type to external service type
                    type_param = (
                        "activity"
                        if transaction_type == TransactionType.ACTIVITY
                        else "manual"
                    )
                    if transaction_type == TransactionType.ACTIVITY:
                        tx_data["timestamp"] = datetime.now(timezone.utc).isoformat()

                    data = await service._make_request(
                        "POST",
                        f"/points/{external_user_id}/add?type={type_param}",
                        json=tx_data,
                    )

                    # Convert response to internal Transaction format with proper type casting
                    try:
                        returned_user_id = str(data["user_id"])
                        if service._parse_int(user_id) is None:
                            returned_user_id = user_id

                        return Transaction(
                            id=int(data["id"]),
                            activity_id=int(data["activity_id"])
                            if data.get("activity_id") is not None
                            else None,
                            user_id=returned_user_id,
                            issued_by_id=str(data["issued_by_id"])
                            if data.get("issued_by_id") is not None
                            else None,
                            points=service._round_points(data["points"]),
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
