from .routes import router
from .schemas.staffpage import StaffPage
from .schemas.leaderboard_page import LeaderboardPage
from .schemas.my_points_page import MyPointsPage
from .schemas.template_qr_claim_page import TemplateQrClaimPage

from .schemas.plugin_settings import Settings
from coffeebreak import ComponentRegistry
import logging

logger = logging.getLogger("coffeebreak.point_system")

SETTINGS = Settings()


def REGISTER():
    logger.info("Point System Plugin registered successfully")
    ComponentRegistry.register_component(StaffPage)
    ComponentRegistry.register_component(LeaderboardPage)
    ComponentRegistry.register_component(MyPointsPage)
    ComponentRegistry.register_component(TemplateQrClaimPage)


def UNREGISTER():
    logger.info("Point System Plugin unregistered")
    ComponentRegistry.unregister_component("StaffPage")
    ComponentRegistry.unregister_component("LeaderboardPage")
    ComponentRegistry.unregister_component("MyPointsPage")
    ComponentRegistry.unregister_component("TemplateQrClaimPage")
