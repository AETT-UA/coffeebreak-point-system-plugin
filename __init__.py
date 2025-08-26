from utils.api import Router
from .routes import router
from .schemas.plugin_settings import Settings
from services.ui.plugin_settings import create_plugin_setting, generate_inputs_from_settings
from schemas.plugin_setting import PluginSetting
import logging

logger = logging.getLogger("coffeebreak.point_system")

IDENTIFIER = "coffeebreak-point-system-plugin"  # must match plugin folder name
NAME = "Point System Plugin"
DESCRIPTION = "Integration with the external point system service for managing user points and leaderboards."

# Create settings instance that will be managed by the plugin service
SETTINGS = Settings()

# Generate plugin inputs from settings
plugin_inputs = generate_inputs_from_settings(Settings)

async def register_plugin():
    """Register the point system plugin and its settings"""
    logger.info("Registering Point System Plugin...")
    
    # Create plugin setting in database
    setting = PluginSetting(
        title=IDENTIFIER,  # identifier used by core to route settings updates
        name=NAME,
        description=DESCRIPTION,
        inputs=plugin_inputs
    )
    await create_plugin_setting(setting)
    
    logger.info("Point System Plugin registered successfully")

def unregister_plugin():
    """Unregister the point system plugin"""
    logger.info("Unregistering Point System Plugin...")
    # Plugin settings cleanup can be handled by the core system

REGISTER = register_plugin
UNREGISTER = unregister_plugin

CONFIG_PAGE = True
