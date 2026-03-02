from .routes import router
from .schemas.staffpage import StaffPage
from .schemas.leaderboard_page import LeaderboardPage
from .schemas.plugin_settings import Settings
from coffeebreak import ComponentRegistry
import logging

logger = logging.getLogger("coffeebreak.point_system")

SETTINGS = Settings()


def REGISTER():
    logger.info("Point System Plugin registered successfully")
    ComponentRegistry.register_component(StaffPage)
    ComponentRegistry.register_component(LeaderboardPage)


def UNREGISTER():
    logger.info("Point System Plugin unregistered")
    ComponentRegistry.unregister_component("StaffPage")
    ComponentRegistry.unregister_component("LeaderboardPage")
