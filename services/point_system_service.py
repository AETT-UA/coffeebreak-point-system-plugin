from typing import List, Optional           # type: ignore
import logging
import random

from ..schemas.point_system import SimpleUser, Transaction, TransactionRequest, TransactionType

logger = logging.getLogger("coffeebreak.point_system")

class PointSystemService:

    class leaderboard:

        @classmethod
        def __fake_leaderboard(cls) -> List[SimpleUser]:
            """Generate a fake leaderboard for testing purposes."""
            return [SimpleUser(id=x, points=y) for x, y in zip(range(1, 11), range(100, 0, -10))]

        @classmethod
        def get(cls) -> List[SimpleUser]:
            """
            Retrieve the general leaderboard of users with their points.
            Returns:
                List of SimpleUser objects representing the leaderboard.
            """

            #TODO: add api call
            logger.debug("Leaderboard called, but not implemented yet. Returning fake data")
            return cls.__fake_leaderboard()

        @classmethod
        def get_activity(cls, activity_id) -> List[SimpleUser]:
            """
            Retrieve the leaderboard of a specific activity.
            Args:
                activity_id: ID of the activity to get the leaderboard for.
            Returns:
                List of SimpleUser objects representing the leaderboard for the activity.
            """

            #TODO: add api call
            logger.debug(f"Leaderboard in activity [{activity_id}] called, but not implemented yet. Returning fake data")
            return cls.__fake_leaderboard()

    class points:

        @classmethod
        def __fake_transaction(cls, user_id: int, points: float) -> Transaction:
            """Generate a fake transaction for testing purposes."""
            return Transaction(
                id=random.randint(1, 1000),
                activity_id=None,
                user_id=user_id,
                issued_by_id=None,
                points=points,
                transaction_type=TransactionType.MANUAL,
                description="Fake transaction for testing",
            )
        @classmethod
        def __fake_points(cls) -> float:
            """Generate a fake points value for testing purposes."""
            return random.uniform(0, 1000)

        @classmethod
        def get(cls, user_id: int) -> float:
            """
            Retrieve the points of a specific user.
            Args:
                user_id: ID of the user to get points for.
            Returns:
                Points of the user.
            """
            # TODO: add api call
            logger.debug(f"Points for user [{user_id}] called, but not implemented yet. Returning fake data")
            return cls.__fake_points()

        @classmethod
        def remove(cls, user_id:int , points:float ) -> bool:
            """
            Remove points from a specific user.
            Args:
                user_id: ID of the user to remove points from.
                points: Number of points to remove.
            Returns:
                True if points were successfully removed, False otherwise.
            """
            # TODO: add api call
            logger.debug(f"Removing {points} points from user [{user_id}], but not implemented yet. Returning True")
            return True

        @classmethod
        def get_history(cls, user_id: int) -> List[Transaction]:
            """
            Retrieve the transaction history of a specific user.
            Args:
                user_id: ID of the user to get points history for.
            Returns:
                List of SimpleUser objects representing the points history.
            """
            # TODO: add api call
            logger.debug(f"Transaction history for user [{user_id}] called, but not implemented yet. Returning transaction history")
            return [cls.__fake_transaction(i, random.uniform(0, 1000) ) for i in range(6)]

        @classmethod
        def get_in_activity(cls, user_id: int, activity_id: int) -> float:
            """
            Retrieve the points of a specific user in a specific activity.
            Args:
                user_id: ID of the user to get points for.
                activity_id: ID of the activity to get points for.
            Returns:
                Points of the user in the activity.
            """
            # TODO: add api call
            logger.debug(f"Points for user [{user_id}] in activity [{activity_id}] called, but not implemented yet. Returning fake data")
            return cls.__fake_points()

        @classmethod
        def create_transaction(cls,user_id:int, transaction: TransactionRequest, transaction_type:TransactionType) -> Optional[Transaction]:
            """
            Create a new transaction for a user.
            Args:
                user_id: ID of the user to create the transaction for.
                transaction: TransactionRequest object containing the details of the transaction.
                transaction_type: Type of the transaction (e.g., 'manual', 'activity').
            Returns:
                Transaction object if the transaction was successfully created, None otherwise.
            """

            #TODO: add api call
            logger.debug(f"Creating transaction for user [{user_id}] with points {transaction.points}, but not implemented yet. Returning fake transaction")

            return cls.__fake_transaction(user_id, transaction.points)
