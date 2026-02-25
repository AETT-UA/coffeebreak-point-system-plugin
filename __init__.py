from .routes import router
from .schemas.plugin_settings import Settings
import logging

logger = logging.getLogger("coffeebreak.point_system")

SETTINGS = Settings()


async def REGISTER():
    logger.info("Point System Plugin registered successfully")


def UNREGISTER():
    logger.info("Point System Plugin unregistered")
