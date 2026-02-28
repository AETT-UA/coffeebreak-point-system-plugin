<<<<<<< HEAD
from coffeebreak.utils.api import Router
from .routes import router
from .schemas.staffpage import StaffPage
from .schemas.plugin_settings import Settings
from coffeebreak.services.ui.plugin_settings import create_plugin_setting, generate_inputs_from_settings
from coffeebreak.schemas.plugin_setting import PluginSetting
=======
from .routes import router
from .schemas.staffpage import StaffPage
from .schemas.plugin_settings import Settings
>>>>>>> 3074779d6b7bfbaff6e5344cc7e2a6c797820e86
from coffeebreak import ComponentRegistry
import logging

logger = logging.getLogger("coffeebreak.point_system")

SETTINGS = Settings()

<<<<<<< HEAD
# Generate plugin inputs from settings

async def register_plugin():
    """Register the point system plugin and its settings"""
    logger.info("Registering Point System Plugin...")


    logger.info("Point System Plugin registered successfully")
    ComponentRegistry.register_component(StaffPage)  # Register the Transaction schema as a component for use in the UI

def unregister_plugin():
    """Unregister the point system plugin"""
    logger.info("Unregistering Point System Plugin...")
    # Plugin settings cleanup can be handled by the core system
    ComponentRegistry.unregister_component("StaffPage")  # Unregister the Transaction component
=======

async def REGISTER():
    logger.info("Point System Plugin registered successfully")
    ComponentRegistry.register_component(StaffPage)

>>>>>>> 3074779d6b7bfbaff6e5344cc7e2a6c797820e86

def UNREGISTER():
    logger.info("Point System Plugin unregistered")
    ComponentRegistry.unregister_component("StaffPage")
