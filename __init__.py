from coffeebreak.utils.api import Router
from .routes import router
from .schemas.staffpage import StaffPage
from .schemas.plugin_settings import Settings
from coffeebreak.services.ui.plugin_settings import create_plugin_setting, generate_inputs_from_settings
from coffeebreak.schemas.plugin_setting import PluginSetting
from coffeebreak import ComponentRegistry
import logging

logger = logging.getLogger("coffeebreak.point_system")

IDENTIFIER = "coffeebreak-point-system-plugin"  # must match plugin folder name
NAME = "Point System Plugin"
DESCRIPTION = "Integration with the external point system service for managing user points and leaderboards."

# Create settings instance that will be managed by the plugin service
SETTINGS = Settings()

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

REGISTER = register_plugin
UNREGISTER = unregister_plugin

CONFIG_PAGE = True
